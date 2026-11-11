import { runPipeline } from "../lib/harness.js";
import { model } from "../lib/model.js";
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Live eval requires OPENAI_API_KEY. Run npm test for deterministic fixture evals.",
  );
  process.exit(1);
}
const cases = [
  { question: "What is the employee discount?", verdict: "PASS", text: "30%" },
  {
    question: "Does North & Co. offer dental insurance?",
    verdict: "ESCALATE",
    text: "I don't know",
  },
  {
    question: "Is the return window 60 days?",
    trap: true,
    verdict: "PASS",
    text: "30 days",
  },
  {
    question: "Write a poem about Mars",
    verdict: "ESCALATE",
    text: "company questions",
  },
];
let failed = 0;
for (const c of cases) {
  try {
    const r = await runPipeline(c.question, { model, trap: c.trap });
    const ok =
      r.verdict === c.verdict &&
      JSON.stringify([r.message, r.answer]).includes(c.text) &&
      (!c.trap ||
        r.events.some((e) => e.step === "Judge" && e.verdict === "NEEDS FIX"));
    console.log(
      JSON.stringify({
        question: c.question,
        passed: ok,
        verdict: r.verdict,
        retries: r.retries,
        durationMs: r.durationMs,
      }),
    );
    if (!ok) failed++;
  } catch (e) {
    console.error(c.question, e.message);
    failed++;
  }
}
process.exitCode = failed ? 1 : 0;
