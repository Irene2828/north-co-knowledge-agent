import "./style.css";
import examples from "./examples.json";
const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let configured = false,
  busy = false,
  current = null,
  events = [];
let runs = [];
try {
  runs = JSON.parse(sessionStorage.getItem("north-runs") || "[]");
  if (!Array.isArray(runs)) runs = [];
} catch {}
const save = () => {
  try {
    sessionStorage.setItem("north-runs", JSON.stringify(runs.slice(0, 30)));
  } catch {}
};
const app = $("#app");
app.innerHTML = `<header><a class="wordmark" href="#demo">NORTH <span>&</span> CO<span class="dot">.</span></a><span class="header-label">THE KNOWLEDGE AGENT</span><nav aria-label="Main navigation"><a href="#demo">Demo</a><a href="#how">How it works</a><a href="#runs">Runs <span id="run-count">03</span></a><a href="#case">The case</a></nav></header><main id="main"></main><footer><span>A fictional company. A working system.</span><span>Built by Iryna Sheremeta <span class="accent">→</span></span><a href="https://github.com/Irene2828/north-co-knowledge-agent">View source →</a></footer>`;
const badge = (text) => `<span class="badge">${escape(text)}</span>`;
function render() {
  const view = location.hash.slice(1) || "demo";
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.hash === "#" + view);
    if (a.hash === "#" + view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#run-count").textContent = String(runs.length + 3).padStart(2, "0");
  const main = $("#main");
  if (view === "demo") {
    main.innerHTML = `<div class="eyebrow"><span class="tiny-dot"></span> AGENT SYSTEM / LIVE DEMO <span class="edition">01 — NORTH & CO.</span></div><section class="hero"><h1>Company knowledge.<br><span>With receipts.</span></h1><div class="hero-aside"><p>A question goes in. A checked,<br>cited answer comes out.</p><p class="muted">Watch every step in between.</p></div></section><div class="workspace"><section class="chat-panel"><div class="panel-heading"><h2>Ask North & Co.</h2><span class="mono">01 / ASK</span></div><p class="muted intro">Policies, store procedures, and the everyday<br class="desktop"> questions that slow a team down.</p><div id="connection" class="connection">Checking live connection…</div><label for="question" class="sr-only">Your company-policy question</label><form id="ask-form"><textarea id="question" maxlength="500" placeholder="What would you like to know?" ${busy ? "disabled" : ""}></textarea><div class="input-footer"><span>General questions only. No personal information.</span><button type="submit" id="ask" ${busy || !configured ? "disabled" : ""}>Ask a question <span>→</span></button></div></form><p class="small-label">A FEW PLACES TO START</p><div class="chips"><button data-q="What is the employee discount?">Employee discount →</button><button data-q="Is the return window 60 days?">The 60-day return trap →</button><button data-q="Does North & Co. offer dental insurance?">Something undocumented →</button></div><div id="answer" aria-live="polite"></div><div class="replays"><span class="small-label">NO KEY? FOLLOW A REAL HARNESS EXAMPLE.</span><div><button data-example="0">01 Clean pass →</button><button data-example="1">02 An honest unknown →</button><button data-example="2">03 Catch & correct →</button></div></div></section><section class="pipeline-panel"><div class="panel-heading"><h2>Inside the harness</h2><span class="mono" id="pipeline-status">READY</span></div><p class="muted intro">Nothing behind the curtain.</p><div id="pipeline" aria-live="polite"></div><div class="pipeline-caption"><span class="tiny-dot"></span> Retrieval → drafting → judgment → delivery.<br>Every answer has to earn its way through.</div></section></div><section class="bottom-strip"><div><span class="stat">24</span><span>source documents</span></div><div><span class="stat">2</span><span>retries, maximum</span></div><div><span class="stat">0</span><span>unsupported claims allowed</span></div><p>Built to show the work.<br><a href="#how">See how the system works →</a></p></section>`;
    $("#ask-form").onsubmit = ask;
    document.querySelectorAll("[data-q]").forEach(
      (b) =>
        (b.onclick = () => {
          $("#question").value = b.dataset.q;
          $("#question").focus();
        }),
    );
    document
      .querySelectorAll("[data-example]")
      .forEach((b) => (b.onclick = () => replay(Number(b.dataset.example))));
    updateConnection();
    renderPipeline();
    renderAnswer();
  } else if (view === "how") {
    main.innerHTML = `<div class="eyebrow">THE SYSTEM / HOW IT WORKS</div><section class="hero"><h1>Trust is a process.<br><span>Here’s ours.</span></h1></section><div class="explain-grid">${[
      [
        "01",
        "The harness",
        "The harness controls the route from question to answer. It searches 24 documents by visible keyword overlap: four points for a title match, one for a body match. Documents scoring at least two points are ranked; the top four, plus an explicitly included escalation directory, become the only evidence the model can use.",
      ],
      [
        "02",
        "The evals",
        "Every claim must match a short, editorially approved fact in a retrieved document and point to its exact section. A separate model call checks support, whether the question was answered, and clarity. A real citation alone is never enough to pass.",
      ],
      [
        "03",
        "The loop",
        "A failed draft returns to the model with the judge’s notes. There are at most two retries, giving three drafting attempts in total. Failed drafts stay visible in the trace, clearly labelled, and are never delivered as final answers.",
      ],
      [
        "04",
        "The guardrails + a human",
        "Unknown questions get an honest “I don’t know” and a role-based escalation contact. Questions outside company operations are refused. Low confidence or exhausted retries require review. Visitors can simulate approval; it is not an authenticated workplace approval.",
      ],
    ]
      .map(
        ([n, t, b]) =>
          `<article><span class="mono accent">${n}</span><h2>${t}</h2><p>${b}</p></article>`,
      )
      .join(
        "",
      )}</div><section class="note"><h2>A small corpus. An intentionally constrained answer.</h2><p>The model selects up to three approved paraphrases rather than freely writing policy. The deterministic check rejects changed text, invented figures, missing citations and mismatched sections. Full document bodies are never sent to the browser. This trades expressive flexibility for an inspectable grounding guarantee.</p><p>Examples use scripted model fixtures through the real harness. Live runs call OpenAI separately for drafting and judging. Both passes can still misunderstand relevance, so an LLM score is evidence to inspect, not a promise of accuracy.</p></section>`;
  } else if (view === "runs") renderRuns();
  else if (view === "case") {
    const live = runs.filter(
      (r) => !r.example && r.durationMs && !r.error && r.approval !== "pending",
    );
    const avg = live.length
      ? live.reduce((s, r) => s + r.durationMs, 0) / live.length
      : null;
    main.innerHTML = `<div class="eyebrow">PORTFOLIO / IRYNA SHEREMETA</div><section class="hero"><h1>A useful answer.<br><span>A visible system.</span></h1><div class="hero-aside"><p>AI Product Builder<br>AI Implementation Strategist</p></div></section><div class="case-stack"><article><span class="mono">01 / PROBLEM</span><h2>Forty stores. The same questions.</h2><p>North & Co. is a fictional Canadian clothing retailer. Staff need practical answers across HR, store operations, product policy, safety and head office. Searching a handbook takes time; an answer without a source creates a different problem.</p></article><article><span class="mono">02 / SOLUTION</span><h2>A harness around the model.</h2><p>Small, consistent documents. Transparent retrieval. A constrained draft. A separate judge, a bounded correction loop, and a review step when certainty runs out. Each run leaves a trace a visitor can inspect.</p></article><article><span class="mono">03 / RESULT</span><h2>Measure the run. Name the assumption.</h2><p>${avg ? `Your ${live.length} live run(s) averaged <strong>${(avg / 1000).toFixed(2)} seconds</strong> of server pipeline time. Against a hypothetical 3-minute manual lookup, that is <strong>${Math.max(0, 180 - avg / 1000).toFixed(1)} seconds</strong> of potential lookup time saved per question.` : "No live measurements in this session yet. Run a live question to see its measured pipeline time and a potential lookup-time comparison."}</p><p class="muted">The 3-minute manual lookup is an assumption, not a study or a measured company baseline. Server timing includes retrieval and model calls, excludes network transit and human review. Scripted examples are excluded from the live average. No production business result is claimed.</p></article></div>`;
  } else {
    location.hash = "demo";
  }
}
function updateConnection() {
  if (!$("#connection")) return;
  $("#connection").textContent = configured
    ? "Live connection ready · server-side model"
    : "Connect a key to try it live. Examples below work now.";
  $("#ask").disabled = busy || !configured;
}
const steps = [
  ["Ask", "Your question, clearly scoped."],
  ["Retrieve", "Relevant documents, with match scores."],
  ["Draft", "A source-backed first answer."],
  ["Judge", "Check every claim and citation."],
  ["Loop", "Correct a failed draft. Up to two retries."],
  ["Approve", "A human reviews uncertainty."],
  ["Log", "Keep the answer and its trace."],
];
function renderPipeline() {
  const node = $("#pipeline");
  if (!node) return;
  node.innerHTML = steps
    .map(([step, desc], i) => {
      const entries = events.filter((e) => e.step === step);
      return `<div class="pipeline-step ${entries.length ? "reached" : ""}"><span class="step-number">${String(i + 1).padStart(2, "0")}</span><div class="step-body"><div class="step-title"><h3>${step}</h3><span>${entries.length ? (step === "Judge" ? entries.filter((e) => e.verdict).at(-1)?.verdict || "CHECKING" : step === "Approve" ? (current?.approval === "approved" ? "APPROVED" : "REVIEW") : "✓") : ""}</span></div><p>${desc}</p>${entries.length ? `<div class="step-detail">${entries.map(eventHTML).join("")}</div>` : ""}</div></div>`;
    })
    .join("");
  $("#pipeline-status").textContent = busy
    ? "RUNNING"
    : current
      ? current.example
        ? "EXAMPLE TRACE"
        : current.verdict
      : "READY";
}
function eventHTML(e) {
  if (e.step === "Retrieve")
    return e.docs.length
      ? e.docs
          .map(
            (d) =>
              `<p><strong>${escape(d.title)}</strong> <span class="accent">${d.score} pts</span><br>${d.reason ? escape(d.reason) : "Matched: " + escape(d.matched.join(", "))}</p>`,
          )
          .join("")
      : "No relevant documents found.";
  if (e.step === "Draft")
    return e.status
      ? "Drafting attempt " + (e.attempt + 1) + "…"
      : `<details><summary>Draft ${e.attempt + 1} · unapproved</summary>${(e.draft?.claims || []).map((c) => `<p>${escape(c.text)}<br><span class="muted">${escape(c.docId)} / ${escape(c.section)}</span></p>`).join("") || escape(e.draft?.kind)}</details>`;
  if (e.step === "Judge")
    return e.status
      ? "Independent check…"
      : `<p>${badge(e.verdict)} · attempt ${e.attempt + 1}<br>Deterministic: ${e.deterministicPassed ? "passed" : "failed"} · Groundedness: ${e.groundedness} · Clarity: ${e.clarity} · Confidence: ${e.confidence}</p><p>${escape(e.notes.join(" "))}</p>`;
  if (e.step === "Loop")
    return `Retry ${e.retry}: ${escape(e.notes.join(" "))}`;
  if (e.step === "Ask") return escape(e.question);
  return escape(e.note || e.status || "");
}
function renderAnswer() {
  const node = $("#answer");
  if (!node) return;
  if (!current) {
    node.innerHTML = "";
    return;
  }
  const pending = current.approval === "pending";
  node.innerHTML = `<div class="answer-box"><div class="panel-heading"><h3>${pending ? "Awaiting human review" : "Final answer"}</h3>${badge(current.verdict)}</div>${current.example ? '<p class="accent mono">EXAMPLE · SCRIPTED MODEL FIXTURE</p>' : ""}${pending ? '<p class="muted">Review candidate — not delivered as a final answer.</p>' : ""}${current.error ? `<p role="alert">${escape(current.error)}</p>` : ""}${current.message ? `<p>${escape(current.message)}</p>` : ""}${current.answer.map((c) => `<p>${escape(c.text)}<span class="citation">${escape(c.title)} → ${escape(c.section)}</span></p>`).join("")}${current.escalation ? `<p>${escape(current.escalation.text)}<span class="citation">${escape(current.escalation.title)} → ${escape(current.escalation.section)}</span></p>` : ""}${pending ? '<p class="muted">You are acting as the demo reviewer. Approval cannot release unsupported draft text.</p><button id="approve">Approve reviewed answer →</button>' : ""}<p class="timing">${current.durationMs} ms pipeline · ${current.retries} ${current.retries === 1 ? "retry" : "retries"}${current.example ? " · local fixture timing, not model latency" : ""}${current.approval === "approved" ? " · approved in demo" : ""}</p></div>`;
  if ($("#approve"))
    $("#approve").onclick = () => {
      current = {
        ...current,
        approval: "approved",
        approvedAt: new Date().toISOString(),
      };
      if (!current.example) {
        runs = runs.map((r) => (r.id === current.id ? current : r));
        save();
      }
      renderAnswer();
      renderPipeline();
    };
}
async function ask(e) {
  e.preventDefault();
  if (busy || !configured) return;
  const question = $("#question").value.trim();
  if (!question) return;
  busy = true;
  current = null;
  events = [];
  renderAnswer();
  renderPipeline();
  updateConnection();
  let error = null;
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw Error(data.error);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        const item = JSON.parse(line);
        if (item.type === "event") {
          events.push(item.event);
          renderPipeline();
        }
        if (item.type === "result") {
          current = item.run;
          runs.unshift(current);
          runs = runs.slice(0, 30);
          save();
          renderAnswer();
        }
        if (item.type === "error") throw Error(item.error);
      }
      if (done) break;
    }
    if (!current)
      throw Error("Connection ended before a completed result. Please retry.");
  } catch (err) {
    error = err.message;
  } finally {
    busy = false;
    updateConnection();
    renderPipeline();
    if (error && $("#answer"))
      $("#answer").innerHTML =
        `<div class="answer-box" role="alert">${escape(error)}</div>`;
    $("#run-count").textContent = String(runs.length + 3).padStart(2, "0");
  }
}
async function replay(index) {
  if (busy) return;
  busy = true;
  current = null;
  events = [];
  renderAnswer();
  updateConnection();
  const source = structuredClone(examples[index]);
  for (const event of source.events) {
    events.push(event);
    renderPipeline();
    await new Promise((r) => setTimeout(r, 130));
  }
  current = source;
  busy = false;
  renderAnswer();
  renderPipeline();
  updateConnection();
}
function renderRuns() {
  $("#main").innerHTML =
    `<div class="eyebrow">THE RECORD / RUN LOG</div><section class="hero"><h1>Every answer.<br><span>Accounted for.</span></h1></section><p class="muted">Live runs stay in this browser tab’s session. They are not shared with other visitors. Up to 30 runs are retained; closing the tab clears them. Examples are scripted fixtures through the real harness.</p><button id="clear-runs" class="text-button">Clear session runs →</button><div class="runs-list">${[...runs, ...examples].map((r, i) => `<details class="run"><summary><span class="mono">${String(i + 1).padStart(2, "0")}</span><span>${escape(r.question)}<small>${r.example ? "EXAMPLE · SCRIPTED FIXTURE" : "LIVE SESSION"} · ${r.durationMs} ms · ${r.retries} retries · ${escape(r.approval)}</small></span>${badge(r.verdict)}</summary><div class="run-content">${r.approval === "pending" ? '<p class="accent">Review candidate — awaiting approval.</p>' : ""}${r.error ? `<p>${escape(r.error)}</p>` : ""}${r.message ? `<p>${escape(r.message)}</p>` : ""}${r.answer.map((c) => `<p>${escape(c.text)}<span class="citation">${escape(c.title)} → ${escape(c.section)}</span></p>`).join("")}${r.events.map((e) => `<div class="trace-row"><strong>${escape(e.step)}</strong><div>${eventHTML(e)}</div></div>`).join("")}</div></details>`).join("")}</div>`;
  $("#clear-runs").onclick = () => {
    runs = [];
    save();
    render();
  };
}
window.addEventListener("hashchange", render);
render();
fetch("/api/status")
  .then((r) => r.json())
  .then((s) => {
    configured = !!s.configured;
    updateConnection();
  })
  .catch(() => updateConnection());
