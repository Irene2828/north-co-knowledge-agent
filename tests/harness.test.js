import test from "node:test";
import assert from "node:assert/strict";
import { docs, facts, retrieve } from "../lib/corpus.js";
import {
  runPipeline,
  claimFor,
  checkDraft,
  UNKNOWN,
  validateQuestion,
} from "../lib/harness.js";
const judge = (notes) => ({
  verdict: notes.length ? "NEEDS FIX" : "PASS",
  groundedness: notes.length ? 0 : 1,
  clarity: 1,
  confidence: 1,
  notes,
});
const fixture = (id) => async (stage, p) =>
  stage === "draft"
    ? { kind: id ? "answer" : "unknown", claims: id ? [claimFor(id)] : [] }
    : judge(p.deterministicNotes);
test("24 documents have 100–250 body words, unique IDs and short approved paraphrases", () => {
  assert.equal(docs.length, 24);
  assert.equal(new Set(facts.map((f) => f.id)).size, facts.length);
  for (const d of docs) {
    const words = [d.intro, ...d.sections.map((s) => s.body)]
      .join(" ")
      .split(/\s+/).length;
    assert.ok(words >= 100 && words <= 250, `${d.title}: ${words}`);
    for (const s of d.sections)
      for (const f of s.facts) {
        assert.ok(f.text.split(/\s+/).length <= 22);
        assert.ok(!s.body.includes(f.text));
      }
  }
});
test("return and discount facts stay consistent across the corpus", () => {
  for (const f of facts.filter((f) => /window|returns require/.test(f.text)))
    assert.match(f.text, /30 days/);
  assert.ok(facts.find((f) => /30%/.test(f.text)));
  for (const d of docs)
    assert.doesNotMatch(JSON.stringify(d), /60 days|50%|sixty calendar days/);
});
test("retrieval is transparent, relevant and deterministic", () => {
  assert.equal(
    retrieve("What is the employee discount?")[0].id,
    "employee-discount",
  );
  assert.deepEqual(
    retrieve("employee discount"),
    retrieve("employee discount"),
  );
  assert.equal(retrieve("quasar astrophysics").length, 0);
});
test("clean run passes with only retrieved citations", async () => {
  const r = await runPipeline("What is the employee discount?", {
    model: fixture("employee-discount-1"),
  });
  assert.equal(r.verdict, "PASS");
  assert.equal(r.retries, 0);
  assert.equal(r.answer.length, 1);
  assert.ok(r.retrieved.some((d) => d.id === r.answer[0].docId));
});
test("uncovered company question escalates with an honest unknown", async () => {
  const r = await runPipeline("Does North & Co. offer dental insurance?", {
    model: fixture(null),
  });
  assert.equal(r.verdict, "ESCALATE");
  assert.equal(r.message, UNKNOWN);
  assert.equal(r.approval, "pending");
  assert.ok(r.escalation);
});
test("planted 60-day trap is caught even if LLM judge incorrectly says PASS; retry fixes it", async () => {
  const r = await runPipeline("Is the return window 60 days?", {
    trap: true,
    model: async (stage, p) =>
      stage === "draft"
        ? {
            kind: "answer",
            claims: [claimFor("return-and-exchange-policy-customers-1")],
          }
        : judge([]),
  });
  assert.equal(
    r.events.find((e) => e.step === "Judge" && e.verdict).verdict,
    "NEEDS FIX",
  );
  assert.equal(r.retries, 1);
  assert.equal(r.verdict, "PASS");
  assert.match(r.answer[0].text, /30 days/);
});
test("nonexistent citation, wrong section and invented fact are rejected", () => {
  const r = retrieve("employee discount");
  for (const c of [
    { ...claimFor("employee-discount-1"), text: "The discount is 90%." },
    { ...claimFor("employee-discount-1"), factId: "made-up" },
    { ...claimFor("employee-discount-1"), section: "Invented" },
  ])
    assert.ok(checkDraft({ kind: "answer", claims: [c] }, r).length);
  assert.ok(
    checkDraft({ kind: "answer", claims: [claimFor("travel-policy-1")] }, r)
      .length,
  );
});
test("exhausted retries cannot release unsafe text through human review", async () => {
  let calls = 0;
  const r = await runPipeline("employee discount", {
    model: async (stage, p) => {
      if (stage === "draft") {
        calls++;
        return {
          kind: "answer",
          claims: [
            { ...claimFor("employee-discount-1"), text: "Discount is 90%." },
          ],
        };
      }
      return judge([]);
    },
  });
  assert.equal(calls, 3);
  assert.equal(r.retries, 2);
  assert.equal(r.verdict, "ESCALATE");
  assert.deepEqual(r.answer, []);
  assert.equal(r.message, UNKNOWN);
});
test("low confidence requires review; out-of-scope refusal contains no claims", async () => {
  const r = await runPipeline("employee discount", {
    model: async (stage, p) =>
      stage === "draft"
        ? { kind: "answer", claims: [claimFor("employee-discount-1")] }
        : { ...judge([]), confidence: 0.5 },
  });
  assert.equal(r.approval, "pending");
  const refusal = await runPipeline("Write a poem about Mars", {
    model: async (stage, p) =>
      stage === "draft" ? { kind: "refuse", claims: [] } : judge([]),
  });
  assert.match(refusal.message, /company questions/);
  assert.deepEqual(refusal.answer, []);
});
test("malformed judge fails closed", async () => {
  await assert.rejects(
    runPipeline("employee discount", {
      model: async (stage, p) =>
        stage === "draft"
          ? { kind: "answer", claims: [claimFor("employee-discount-1")] }
          : { verdict: "PASS" },
    }),
  );
});
test("input rejects common personal identifiers and oversized requests", () => {
  assert.ok(validateQuestion("My email is jane@example.com"));
  assert.ok(validateQuestion("Call 416-555-0123"));
  assert.ok(validateQuestion("x".repeat(501)));
  assert.equal(validateQuestion("What is the employee discount?"), null);
});
