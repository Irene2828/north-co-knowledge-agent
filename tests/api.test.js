import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/run.js";
import status from "../api/status.js";
import { claimFor } from "../lib/harness.js";
function response() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(body) {
      this.body = body;
    },
    write(chunk) {
      this.chunks.push(chunk);
    },
    end() {
      this.ended = true;
    },
  };
}
test("server status and no-key behavior never expose credentials", async () => {
  const old = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = response();
    status({}, res);
    assert.deepEqual(res.body, { configured: false });
    const missing = response();
    await handler(
      { method: "POST", body: { question: "employee discount" } },
      missing,
    );
    assert.equal(missing.statusCode, 503);
    const wrong = response();
    await handler({ method: "GET" }, wrong);
    assert.equal(wrong.statusCode, 405);
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
  }
});
test("API streams real harness events through the provider transport and final supported claims", async () => {
  const old = process.env.OPENAI_API_KEY,
    originalFetch = global.fetch;
  process.env.OPENAI_API_KEY = "test-only-placeholder";
  let calls = 0;
  global.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.ok(body.messages[0].content);
    const draft = body.messages[0].content.includes("knowledge agent");
    calls++;
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(
                draft
                  ? {
                      kind: "answer",
                      claims: [claimFor("employee-discount-1")],
                    }
                  : {
                      verdict: "PASS",
                      groundedness: 1,
                      clarity: 1,
                      confidence: 1,
                      notes: [],
                    },
              ),
            },
          },
        ],
      }),
    };
  };
  try {
    const res = response();
    await handler(
      { method: "POST", body: { question: "What is the employee discount?" } },
      res,
    );
    const packets = res.chunks.map((s) => JSON.parse(s));
    assert.equal(packets[0].event.step, "Ask");
    assert.ok(packets.some((p) => p.event?.step === "Judge"));
    assert.equal(packets.at(-1).type, "result");
    assert.equal(packets.at(-1).run.verdict, "PASS");
    assert.match(packets.at(-1).run.answer[0].text, /30%/);
    assert.equal(calls, 2);
    assert.equal(res.headers["Content-Type"], "application/x-ndjson");
    assert.equal(
      JSON.stringify(packets).includes("test-only-placeholder"),
      false,
    );
  } finally {
    global.fetch = originalFetch;
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
  }
});
test("provider failure is logged for review without a model answer", async () => {
  const old = process.env.OPENAI_API_KEY,
    originalFetch = global.fetch;
  process.env.OPENAI_API_KEY = "test-only-placeholder";
  global.fetch = async () => ({ ok: false, status: 401 });
  try {
    const res = response();
    await handler(
      { method: "POST", body: { question: "employee discount" } },
      res,
    );
    const packets = res.chunks.map((s) => JSON.parse(s));
    assert.equal(packets.at(-1).type, "result");
    assert.equal(packets.at(-1).run.verdict, "ESCALATE");
    assert.deepEqual(packets.at(-1).run.answer, []);
    assert.ok(packets.at(-1).run.error);
  } finally {
    global.fetch = originalFetch;
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
  }
});
