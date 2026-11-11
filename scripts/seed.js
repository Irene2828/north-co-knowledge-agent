import fs from "node:fs";
import { runPipeline, claimFor } from "../lib/harness.js";
const cases = [
  ["What is the employee discount?", "employee-discount-1", false],
  ["Does North & Co. offer dental insurance?", null, false],
  [
    "Is the return window 60 days?",
    "return-and-exchange-policy-customers-1",
    true,
  ],
];
const examples = [];
for (const [question, id, trap] of cases) {
  const run = await runPipeline(question, {
    trap,
    model: async (stage, payload) =>
      stage === "draft"
        ? { kind: id ? "answer" : "unknown", claims: id ? [claimFor(id)] : [] }
        : {
            verdict: payload.deterministicNotes.length
              ? "NEEDS FIX"
              : id
                ? "PASS"
                : "ESCALATE",
            groundedness: payload.deterministicNotes.length ? 0 : 1,
            clarity: 1,
            confidence: 1,
            notes: payload.deterministicNotes.length
              ? ["The draft says 60 days. The source policy specifies 30 days."]
              : id
                ? ["All claims match the retrieved facts."]
                : [
                    "Dental insurance is not covered by the retrieved documents.",
                  ],
          },
  });
  run.example = true;
  run.createdAt = "2026-03-02T15:00:00.000Z";
  run.timingLabel =
    "Measured local harness time; scripted model fixture, not live model latency.";
  examples.push(run);
}
fs.writeFileSync("src/examples.json", JSON.stringify(examples, null, 2) + "\n");
