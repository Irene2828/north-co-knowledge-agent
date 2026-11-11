# North & Co. Knowledge Agent

A working portfolio demo by **Iryna Sheremeta — AI Product Builder / AI Implementation Strategist**. North & Co. is a fictional Canadian clothing retailer with 40 stores. All policies and company information are invented. No real employee or customer records are included.

## Run locally

Requires Node 22 or later.

```sh
npm install
cp .env.example .env
# Set OPENAI_API_KEY in .env (never commit it).
npm run dev
```

Open http://localhost:3000. The local Node server runs the same API handlers used on Vercel, with Vite serving the static frontend. `npm run build` produces `dist/`. Without a key, the site clearly disables live submission; all four views and the three example replays work.

`OPENAI_API_KEY` is read only by the server. Optional `OPENAI_MODEL` defaults to `gpt-4.1-mini`; select a model that supports Chat Completions JSON-object responses and temperature. The server makes direct HTTPS calls to OpenAI, as specified in the brief. There is no model key in the browser, bundle, repository, or logs. OpenAI API access and billing are prerequisites for live use.

## Harness design

1. **Ask:** accept a general policy question of 1–500 characters. Reject common email, phone, URL and personal-identifier patterns. The interface explicitly asks visitors not to enter personal information. This is a heuristic input filter, not a comprehensive personal-data classifier; free text is sent to OpenAI. Use invented policy questions only.
2. **Retrieve:** normalize keywords, remove a fixed stop-word list, and score unique overlap: a title match contributes 4 points; a body match contributes 1. Keep the top 4 documents scoring at least 2, then always include the escalation directory if absent (shown with score 0 and an explicit reason). Return titles, scores and matched terms to the visitor. This simple search deliberately exposes its limitations; lexical overlap does not establish relevance.
3. **Draft:** send only the retrieved documents’ approved facts to the model. It selects up to 3 short approved paraphrases, each with a fact ID, document ID and section. The full source prose is not sent to the browser or the model. This is a constrained answer composer, not unrestricted text generation: the model chooses relevant facts, unknown, or refusal.
4. **Judge:** deterministic validation requires exact approved fact text and an existing citation in the retrieved set. A separate OpenAI call checks groundedness, relevance, false premises, completeness, clarity and confidence. Any deterministic failure overrides an LLM PASS. PASS requires groundedness 1, clarity at least 0.8 and confidence at least 0.85. Scores are model assessments, not calibrated probabilities.
5. **Loop:** a NEEDS FIX verdict returns notes to drafting. At most 2 retries (3 attempts). Trace entries show the failed drafts as unapproved, never as final answers.
6. **Approve:** unknown, refused, low-confidence and exhausted-retry runs require review. The visitor acts as a simulated reviewer. A failed deterministic draft is replaced by the fixed unknown message before approval; the Approve button cannot release unsupported prose. This is a portfolio demonstration, not an authenticated staff approval system.
7. **Log:** the response streams newline-delimited JSON events as they occur, followed by a completed run. Completed runs, including pending-review runs, are saved in browser `sessionStorage`; approvals update that session record. No public shared log or database. Up to 30 records per tab; closing the tab clears them. Use “Clear session runs” to remove them earlier. Provider failures are logged as ESCALATE with an error note and a safe unknown response awaiting review; no model answer is delivered.

Both model passes receive explicit instructions to treat questions and drafts as untrusted data. The application renders text with HTML escaping. The final claim whitelist provides the grounding guarantee: factual answer prose cannot differ from a retrieved, approved fact. It does **not** guarantee the model selected the right fact or fully understood the question; the independent judge and review step address that separate limitation. Fixed unknown/refusal interface copy is not a company-policy claim. An unknown answer includes the approved escalation fact from the explicit contact directory, separately cited from the visibly retrieved escalation directory.

Full documentation is public in `knowledge/` because this is a public, fictional corpus. The application reveals only short facts and section citations, not document bodies. A real internal deployment would require authentication, document access controls, a durable private audit store, reviewer identities and approvals enforced by the server. This demo intentionally has none of those production claims.

## Knowledge base

24 JSON files cover every title in the brief (approximately 25 requested). Each document has 100–250 words of source prose, an owner, effective date, named sections and two approved fact paraphrases. The policy edition is March 1, 2026. References are role-based; there are no personal contacts.

Shared invariants include the 30-day customer return window, 30% employee discount, CAD 200 till float, no offline card payments, and 30-day expense submission. Edit source prose and approved facts together. The facts are editorial assertions tied to sections; tests cannot prove their semantic truth. Review policy changes for consistency.

## Evals and verification

```sh
npm test                         # offline deterministic + API integration checks
npm run build                    # production static bundle
npm run test:browser              # desktop/mobile UI and streamed response checks
node --env-file=.env scripts/eval.js  # real draft + real LLM judge; incurs model usage
```

For browser tests, install Chromium with `npx playwright install chromium` if needed. Set `CHROMIUM_PATH=/usr/bin/chromium` to use a system installation. Tests start the local server automatically.

Offline tests cover valid answers, missing support, invalid citations and sections, invented numbers, unrelated facts, exhausted retries, low confidence, malformed model output, input validation and corpus invariants. API tests mock the provider transport, not the harness. Browser tests distinguish fixture responses from real model calls.

The live eval checks a clean staff-discount question, undocumented dental insurance, out-of-scope poetry, and a **controlled fault injection**: the first return-policy draft is replaced with a plausible but wrong “60 days” claim. The real judge call still executes; deterministic validation must flag the mismatch, then the corrected draft must pass. This is a test-only injection, never enabled by the public API. Merely asking “Is the return window 60 days?” may produce a correct first draft; it should not be described as a failed judge if no error occurred.

Three example runs are generated by `node scripts/seed.js` through the real harness with explicitly scripted draft/judge fixtures: clean PASS, undocumented question, failed first draft then PASS. They are labelled **EXAMPLE / SCRIPTED FIXTURE** throughout. Their milliseconds are measured local harness execution, not fabricated model latency. Replay uses a short presentation delay independent of those measurements. Regenerating examples changes their IDs and timings.

### Verification performed in the build workspace

- `npm install`, `npm test` and `npm run build` passed.
- Chromium checks cover desktop and mobile layout, navigation, example replay, retry trace, simulated approval, missing-key state and streamed response rendering.
- No OpenAI key was supplied. Real-provider evals and Vercel live verification have **not** been performed. Do not claim deployment acceptance until those pass.

## Deploy to Vercel after merge

Import this GitHub repository into Vercel. Use the Vite preset, build command `npm run build`, output directory `dist`, and Node 22 or later. The `api/*.js` files deploy as Node serverless functions. `vercel.json` gives the pipeline a 120-second maximum duration and sets security headers. Each model call has a 14-second timeout; there are at most 6 calls. If a provider call fails or times out, the run fails closed.

Add `OPENAI_API_KEY` to the relevant Vercel Preview/Production environment variables, optionally add `OPENAI_MODEL`, then redeploy. Never prefix a secret with `VITE_`. Do not paste it into a PR, issue or chat. No storage service is needed; the server is stateless. The corpus is loaded from files through Node filesystem access; Vercel’s function tracer includes the `knowledge/` directory.

After deployment, ask “What is the employee discount?” and verify live steps and the cited 30% answer. Ask the dental-insurance question and verify the unknown message and review step. Run the live controlled-trap eval locally with the same model/key, then check the deployed 60-day question is corrected to 30 days. Inspect the session Runs page and approve a pending review. Confirm `/api/status` exposes only a boolean and that the browser assets contain no secrets. Public usage consumes the configured OpenAI account’s quota; set provider spend limits before broad promotion. This demo has no cross-instance abuse limiter.

## Timing and the case study

Each run records elapsed server pipeline milliseconds, including retrieval and model calls, excluding network transit and human review. The Case view averages only non-error live session runs that have passed or been reviewed; pending reviews are excluded. Potential time saved compares that average with an explicitly hypothetical **3-minute manual lookup**. No production impact or measured staff baseline is claimed. Human-review wait time is not counted as saved time.

## Layout

- `src/`: four hash-routed views, responsive matte off-black/pink-peach design; no UI icon library, shadows or external fonts.
- `knowledge/`: fictional source documents and approved facts.
- `lib/`: retrieval, harness, deterministic judge and OpenAI transport.
- `api/`: server-only configuration status and streaming run handler.
- `scripts/`: example generation and opt-in live model evals.
- `tests/`: offline and browser checks.

MIT licensed; see [LICENSE](LICENSE).
