import {
  docs,
  retrieve,
  allowedFacts,
  publicRetrieval,
  facts,
} from "./corpus.js";
export const UNKNOWN = "I don't know — this isn't in our documents";
export const ESCALATION = facts.find(
  (f) => f.id === "who-to-contact-escalation-contacts-list-1",
);
export function checkDraft(draft, retrieved) {
  const notes = [];
  const available = allowedFacts(retrieved);
  if (
    !draft ||
    !["answer", "unknown", "refuse"].includes(draft.kind) ||
    !Array.isArray(draft.claims) ||
    draft.claims.length > 3
  )
    return ["Invalid draft structure."];
  if (draft.kind === "answer" && !draft.claims.length)
    notes.push("An answer needs at least one supported claim.");
  if (draft.kind !== "answer" && draft.claims.length)
    notes.push("Unknown and refusal drafts cannot contain claims.");
  const seen = new Set();
  for (const claim of draft.claims) {
    const f = available.find((f) => f.id === claim.factId);
    if (!f) {
      notes.push("Citation does not exist in retrieved documents.");
      continue;
    }
    if (claim.text !== f.text)
      notes.push(
        "Claim differs from its approved source fact; unsupported fact or quotation.",
      );
    if (claim.docId !== f.docId || claim.section !== f.section)
      notes.push("Citation title/section mismatch.");
    if (seen.has(f.id)) notes.push("Repeated claim.");
    seen.add(f.id);
  }
  return notes;
}
export const claimFor = (id) => {
  const f = facts.find((f) => f.id === id);
  return { factId: f.id, text: f.text, docId: f.docId, section: f.section };
};
export function validateQuestion(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 500)
    return "Use a question between 1 and 500 characters.";
  if (
    /@|https?:|\b\d[\d ()+.-]{6,}\d\b|\b(my name is|i am named|employee id|customer name|my address|my phone|my email)\b/i.test(
      value,
    )
  )
    return "Please remove personal information. Use a general company-policy question.";
  return null;
}
export async function runPipeline(
  question,
  { model, emit = () => {}, trap = false } = {},
) {
  const start = performance.now();
  const events = [];
  const send = (step, data) => {
    const event = { step, ms: Math.round(performance.now() - start), ...data };
    events.push(event);
    emit(event);
  };
  send("Ask", { question });
  const retrieved = retrieve(question);
  // The fallback contact is evidence too; show it rather than citing an unseen source.
  const directory = docs.find((d) => d.id === ESCALATION.docId);
  if (!retrieved.some((d) => d.id === directory.id))
    retrieved.push({
      id: directory.id,
      title: directory.title,
      score: 0,
      matched: [],
      doc: directory,
      reason: "Always included for escalation routing.",
    });
  send("Retrieve", {
    docs: publicRetrieval(retrieved),
    rule: "Unique keyword overlap: title match +4, body match +1. Minimum score 2; top 4 matches, plus the escalation directory.",
  });
  const available = allowedFacts(retrieved);
  let draft,
    verdict = "ESCALATE",
    retries = 0,
    judge;
  for (let attempt = 0; attempt < 3; attempt++) {
    send("Draft", { status: "running", attempt });
    draft = await model("draft", {
      question,
      facts: available,
      notes: judge?.notes || [],
      attempt,
    });
    if (trap && attempt === 0)
      draft = {
        kind: "answer",
        claims: [
          {
            ...claimFor("return-and-exchange-policy-customers-1"),
            text: "The return and exchange window is 60 days from purchase.",
          },
        ],
      };
    const problems = checkDraft(draft, retrieved);
    send("Draft", {
      attempt,
      draft: problems.length
        ? {
            kind: draft?.kind,
            claims: (draft?.claims || [])
              .map((c) => ({
                text: c.text,
                docId: c.docId,
                section: c.section,
              }))
              .slice(0, 3),
          }
        : draft,
    });
    send("Judge", { status: "running", attempt });
    const llm = await model("judge", {
      question,
      draft,
      facts: available,
      deterministicNotes: problems,
    });
    if (
      !llm ||
      !Number.isFinite(llm.groundedness) ||
      !Number.isFinite(llm.clarity) ||
      !Number.isFinite(llm.confidence) ||
      ![llm.groundedness, llm.clarity, llm.confidence].every(
        (n) => n >= 0 && n <= 1,
      ) ||
      !["PASS", "NEEDS FIX", "ESCALATE"].includes(llm.verdict) ||
      !Array.isArray(llm.notes) ||
      llm.notes.some((n) => typeof n !== "string")
    )
      throw new Error("Invalid judge response");
    verdict = problems.length
      ? "NEEDS FIX"
      : draft.kind !== "answer"
        ? "ESCALATE"
        : llm.verdict;
    if (verdict === "PASS" && (llm.groundedness < 1 || llm.clarity < 0.8))
      verdict = "NEEDS FIX";
    if (verdict === "PASS" && llm.confidence < 0.85) verdict = "ESCALATE";
    judge = { ...llm, verdict, notes: [...problems, ...llm.notes] };
    send("Judge", { attempt, ...judge, deterministicPassed: !problems.length });
    if (verdict !== "NEEDS FIX") break;
    if (attempt < 2) {
      retries++;
      send("Loop", { retry: retries, notes: judge.notes });
    }
  }
  if (verdict === "NEEDS FIX") verdict = "ESCALATE";
  // Unsafe text is never made final, even by a human approval.
  const safe =
    checkDraft(draft, retrieved).length === 0 && draft.kind === "answer";
  const answer = safe
    ? draft.claims.map((c) => {
        const f = facts.find((f) => f.id === c.factId);
        return { ...c, title: f.title };
      })
    : [];
  const message =
    draft?.kind === "refuse"
      ? "I can help with North & Co. company questions. Please ask about a company policy or procedure."
      : answer.length
        ? ""
        : UNKNOWN;
  const run = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    question,
    retrieved: publicRetrieval(retrieved),
    answer,
    message,
    verdict,
    retries,
    durationMs: Math.round(performance.now() - start),
    events,
    approval: verdict === "ESCALATE" ? "pending" : "not-required",
    escalation: verdict === "ESCALATE" ? ESCALATION : null,
  };
  if (verdict === "ESCALATE")
    send("Approve", {
      status: "pending",
      note: "A visitor can act as the demo reviewer. This is a simulated review, not a company approval.",
    });
  send("Log", {
    status: verdict === "ESCALATE" ? "awaiting-review" : "complete",
  });
  run.durationMs = Math.round(performance.now() - start);
  return run;
}
