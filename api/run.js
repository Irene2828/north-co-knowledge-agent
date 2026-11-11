import {
  runPipeline,
  validateQuestion,
  UNKNOWN,
  ESCALATION,
} from "../lib/harness.js";
import { model } from "../lib/model.js";
export const config = { maxDuration: 120 };
// No global run store: session records stay in the visitor's browser, never in a shared public log.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST." });
  const problem = validateQuestion(req.body?.question);
  if (problem) return res.status(400).json({ error: problem });
  if (!process.env.OPENAI_API_KEY)
    return res.status(503).json({
      error: "Connect a key to try it live. Set OPENAI_API_KEY on the server.",
    });
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const events = [];
  const started = performance.now();
  const emit = (event) => {
    events.push(event);
    res.write(JSON.stringify({ type: "event", event }) + "\n");
  };
  try {
    const run = await runPipeline(req.body.question.trim(), {
      model,
      emit,
    });
    res.write(JSON.stringify({ type: "result", run }) + "\n");
  } catch {
    const error =
      "The model could not complete this run. Check the server key, model access or provider availability, then retry. No model answer was delivered.";
    emit({
      step: "Approve",
      ms: Math.round(performance.now() - started),
      status: "pending",
      note: error,
    });
    emit({
      step: "Log",
      ms: Math.round(performance.now() - started),
      status: "failed-awaiting-review",
    });
    const run = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      question: req.body.question.trim(),
      retrieved: events.find((e) => e.step === "Retrieve")?.docs || [],
      answer: [],
      message: UNKNOWN,
      verdict: "ESCALATE",
      retries: events.filter((e) => e.step === "Loop").length,
      durationMs: Math.round(performance.now() - started),
      events,
      approval: "pending",
      escalation: ESCALATION,
      error,
    };
    res.write(JSON.stringify({ type: "result", run }) + "\n");
  }
  res.end();
}
