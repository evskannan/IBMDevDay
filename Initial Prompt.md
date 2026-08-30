# IBMDevDay
IBM Dev Day Hackathon Challenge - TCS CBE | Co - Creators

# SpecBridge — IBM Bob Hackathon Build Spec (v3)

> **For IBM Bob (Agent Mode).** This is a build brief, not a suggestion.
> Read the whole file, then build in the milestone order in Section 12.
>
> **Event:** IBM TechXchange 2026 Pre-conference Dev Day Hackathon
> **Theme:** Build with purpose using IBM Bob 2.0
> **Team:** Solo (1 person, 40 Bobcoins, no top-ups after 100%)

---

## Why "SpecBridge"?

The tool's core value is **bridging the gap between a human conversation and
machine-buildable deployment code** — for any target platform.
Maximo is the first demo target; the same pipeline applies to ServiceNow, SAP,
custom REST APIs, or any system that accepts scripted automation.

The name is deliberately platform-agnostic. This is an **SDLC accelerator**, not
a Maximo utility.

---

## 0. Hard constraints (read before anything else)

| Constraint | Value | Source |
|---|---|---|
| Bob IDE version | must be **v2.0.2 or later** (v1.0.3 and v2.0.0 stop working 30 Sep 2026) | Guide, "Install Bob IDE" |
| Bob account | **ibm-coding-challenge-uat (region: us-east)** — verify in Settings → General before every session | Guide, "Sign into Bob IDE" |
| Bobcoins | 40 total, solo. Check Settings → General → Usage after every milestone | Guide, "Bobcoins" |
| IBM Cloud account | must be **`xxxxxxx - watsonx`**, region **Dallas**, not a personal account | Guide, "Accessing your hackathon IBM Cloud account" |
| Credits | $80. Suspension at 100%. Alerts are hourly, so they can lag actual spend | Guide, "Note on IBM Cloud service usage" |
| Deployment | hackathon cloud accounts **do not support deployment** — run locally, demo locally | Guide, "Quick start hands-on exercises" |
| Banned models | `llama-3-405b-instruct`, `mistral-medium-2505`, `mistral-small-3-1-24b-instruct-2503` | Guide, watsonx.ai section |
| Data | synthetic only — no client, confidential, personal, or social-media data | Guide, "A note on data sets" |
| Credentials | any IBM Cloud key found in a public repo = key deactivated + account suspended | Guide, "Note on preventing exposure" |
| Evidence | `bob_sessions/` folder of task-session summary PNGs is a **required deliverable** | Guide, "Uploading Bob task session summary" |

**Screenshot naming.** Use `<myhandle>_task01_<shortdesc>.png` — include a name, not just `solo_`.

---

## 1. Problem framing (this is what gets judged)

The theme asks for a solution that **improves a specific developer workflow**.

> **Problem:** In enterprise application-maintenance work (Maximo, ServiceNow, SAP,
> and similar platforms), developers receive enhancement requests as prose specs that
> omit the exact target object, launch-point type, trigger condition, and error path.
> The developer stops, chases the BA, guesses, or builds the wrong thing.
> The rework loop is measured in days.
>
> **Solution:** SpecBridge converts a requirement conversation (transcript, meeting
> notes, or recorded interview) into a *machine-buildable* spec — one file per
> component, containing every field a coding agent needs to build without asking a
> human anything. The proof that the spec is buildable is that **Bob builds from it,
> unassisted, on stage.**

**Workflow improved:** application maintenance & modernization — specifically the
spec→code handoff, platform-agnostic.

Do not describe this as "a document generator". Describe it as **eliminating the
spec-ambiguity round trip that blocks developers, across any target platform.**

---

## 2. The two milestones and two roles of Bob

### Milestone 1 — Bob BUILDS SpecBridge (meta level)

Bob, driven by this spec, scaffolds and builds SpecBridge: a browser-only app
that converts meeting transcripts into structured FSD / TSD / RICEF specifications
and exports a machine-buildable handoff bundle.

The demo target for Milestone 1 is the **Maximo PM work-order enhancement thread**
(see Section 5). The app is not Maximo-specific — the thread is used because it is
concrete enough to validate the whole pipeline end to end.

### Milestone 2 — Bob CONSUMES the output and DEPLOYS to a target system (object level)

The app exports a Bob-ready handoff bundle. That bundle, together with a target
system's API details, goes back into Bob, and Bob writes and deploys the actual
automation code.

**For the Maximo demo:**

1. The user pastes `RICEF-E-001.md` into a fresh Bob task.
2. The user also provides:
   - Maximo REST API base URL (e.g. `https://<host>/maximo`)
   - Maximo API key or Basic credentials
3. Bob reads `RICEF-E-001.md`, writes the Maximo Automation Script (Jython/Nashorn),
   and deploys it via `POST /maximo/oslc/script` — no human edits the code.
4. Bob confirms deployment with a `GET` on the script resource.

**The same handoff pattern applies to other platforms:**
- ServiceNow: Bob writes a Business Rule and POSTs it to the Table API.
- Custom REST app: Bob writes a handler and POSTs to the app's admin endpoint.
- The handoff bundle format does not change; only the deploy adapter changes.

> **Closed loop:**
> Conversation → SpecBridge (built by Bob, Milestone 1) → `RICEF-E-001.md` →
> Bob + target API → deployed automation code (Milestone 2).

This loop is the headline of the submission. If time runs short, protect the loop and
cut everything else.

---

## 3. Scope

A **fully UI-driven, browser-only** web app. No backend server, no database server, no
Docker, no cloud deployment. One thin vertical slice, end to end:

    Synthetic meeting transcript (any platform domain)
        -> extracted requirements (with evidence spans)
        -> AS-IS / TO-BE mapping
        -> ONE RICEF-E (Enhancement) item
        -> FSD + TSD (filled into an uploaded DOCX template)
        -> Bob handoff bundle (RICEF-E-001.md)

**Explicit non-goals for v1 — say so, do not silently build:**
- No multi-user, no roles, no auth server.
- No PostgreSQL / pgvector / MinIO / Celery / Redis.
- No template-fidelity XML engine — docxtemplater style-preserving fill is enough.
- SpecBridge never connects to the target system and never writes deployment code.
  That is Bob's job in Milestone 2.
- No cloud deployment. The demo runs on localhost.

---

## 4. Scope thread — PM work-order enhancement (Maximo demo)

> "When a preventive-maintenance work order is generated for a high-criticality asset,
> automatically set its priority and notify the planner."

Resolves to a **RICEF-E (Enhancement)**, realized in Maximo as an **Automation Script**
on the WORKORDER object (object launch point, on init/save), with a conditional
expression on asset criticality.

The app must carry this thread all the way to a `RICEF-E-001.md` that Bob can build
from with no human input. This same thread is used in the Milestone 2 deploy demo.

**Other platform equivalents (for the submission narrative):**
| Domain | Equivalent thread |
|---|---|
| ServiceNow | Incident auto-escalation rule when CI criticality = HIGH |
| SAP | Workflow task auto-assignment on equipment priority |
| Custom REST app | Order auto-prioritization trigger on asset classification |

---

## 5. Architecture & tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Vite + React 18 | Fast dev server, modern build |
| Styling | Vanilla CSS + custom properties | Dark mode, neutral platform palette |
| DOCX read | mammoth.js | Parse uploaded transcripts & templates |
| DOCX write | docxtemplater + PizZip + FileSaver | Output DOCX preserving template styling |
| ZIP | JSZip | Handoff bundle export |
| LLM calls | Native fetch (SSE streaming) | OpenAI-compatible + watsonx.ai |
| State | React Context + useReducer | Global app state |
| Storage | IndexedDB + localStorage | Projects, templates, LLM config |
| Icons | lucide-react | Icon set |

### 5.1 CORS — build this in from Milestone 1, do not discover it at Milestone 3

A browser page cannot reliably call `iam.cloud.ibm.com` or `us-south.ml.cloud.ibm.com`
directly; those endpoints are not configured for arbitrary browser origins. Assume the
direct call will be blocked and design for it:

- Add a **Vite dev-server proxy** (`server.proxy` in `vite.config.js`) mapping
  `/ibm-iam` → `https://iam.cloud.ibm.com` and `/watsonx` → the Dallas ML endpoint.
- The provider adapter reads a base path from config, so it points at the proxy in dev
  and at the real host if a deployment ever allows it.
- **The proxy is a dev-server route, not an application backend.** The
  "browser-only, no server" claim stays true for the app itself, and the demo runs on
  `npm run dev` anyway. Say this plainly in the README so a judge doesn't read it as a
  contradiction.
- The OpenAI-compatible provider gets the same treatment — many gateways also refuse
  browser origins.

**Rules:** API keys live in localStorage and are clearable from the UI; no telemetry;
no data leaves the browser except to the configured LLM endpoint. Commit a `.gitignore`
and a `.bobignore` covering `.env`, `*.key`, `secrets/`, `config/credentials.json`
**in Milestone 1**, before any key is ever pasted into the app.

---

## 6. Inference — two providers, watsonx first

Two independently configurable LLM roles: a **Generator** (drafts specs) and a
**Validator** (reviews them). Each has: Base URL, masked API key, model dropdown
(fetched from the endpoint, manual fallback), Test-connection button.

### Provider 1 — IBM watsonx.ai (default)
Judges favour the IBM stack, and the $80 credit is already allocated. Make this the
default and the demo path.

1. Needs three values from the watsonx.ai home page → **Developer access** panel:
   **project ID**, **endpoint URL** (`https://us-south.ml.cloud.ibm.com`, Dallas), and
   an **API key**. When creating the key, choose **Delete the leaked key**.
2. Two-step auth: exchange the API key for an **IAM bearer token** (~60 min) via
   `POST https://iam.cloud.ibm.com/identity/token` with
   `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=<KEY>`, then call the
   model. Read `expires_in` from the response; refresh at 80% of it, not on 401.
3. Billing: 1,000 tokens = 1 RU = $0.0001. Log RU spend in the metrics header so I can
   see credit burn live.

Adapter (`watsonxProvider`) caches the IAM token, auto-refreshes, and posts to the
chat/text-generation endpoint with `project_id` and `model_id`. Same interface as the
OpenAI adapter so the UI is identical.

**Model:** a Granite chat model. Never the three banned models — hard-code a
denylist in the model dropdown so they cannot be selected even manually.

### Provider 2 — OpenAI-compatible endpoint (fallback)
`POST {base_url}/chat/completions`, SSE streaming. Works with OpenAI, NVIDIA NIM,
OpenRouter, or any compatible gateway. This is the safety net if watsonx credits run
out mid-demo — and it must work, because credit alerts lag by up to an hour.

---

## 7. watsonx Orchestrate — inverted from v1

**The app calls Orchestrate, not the other way round:**

- **Agent name:** *Spec Review & Handoff Agent*
- **Agent lives in Orchestrate**, has its own instructions and its own Granite model,
  and holds the Validator rubric as agent instructions.
- **Trigger:** the user clicks "Send for Review" in the app. The app POSTs the generated
  FSD/TSD text to the Orchestrate chat API and renders the agent's structured verdict.
- **Agent returns:** per-criterion scores, blockers, warnings, and a pass/fail.
- **On pass**, the app (not the agent) assembles the handoff bundle locally.
- **Build path:** create the agent in Orchestrate with the Builder role. Use Bob to
  generate the agent config.
- **AgentOps is out of scope** for this hackathon. Do not use it.

**Fallback is mandatory:** if Orchestrate is unreachable, "Send for Review" silently
falls back to the local Validator LLM. The core loop must survive without Orchestrate.

---

## 8. Data — synthetic only

Ship one seeded sample, generated into the repo so the demo runs offline:

    Synthetic PM planning meeting, fictional "EAGLE Utilities", HV transformers.
    Speakers: Planner, Reliability Engineer, Maximo Consultant.
    Content: high-criticality assets need auto-priority on PM work orders;
    planner must be notified; criticality read from the asset spec.

**Also ship a synthetic DOCX template.** The template-upload feature must be
demonstrated with a self-authored FSD/TSD template committed to the repo. Do not upload
or commit a real client document template.

---

## 9. Where Bob's differentiating features are used

The theme rewards using Bob beyond plain coding. Each of these must show up in a
`bob_sessions/` screenshot:

- **Agent mode** — scaffold the app end-to-end (Milestones 1–5).
- **Document understanding** — Bob reads this spec and the DOCX template to drive
  generation logic. The app itself does document understanding on transcripts.
- **Parallel tasks** — generate independent FSD/TSD sections concurrently.
- **Subagents** — a "platform-correctness" subagent that checks named objects,
  launch points, and field names are valid for the target platform.
- **`/init` + AGENTS.md** — persistent project context.
- **Custom rules** — enforce React/Vite conventions and platform terminology.
- **Skills** — a reusable "RICEF spec writer" skill, so the pattern generalizes past
  this one component and one platform.

---

## 10. The Bob handoff bundle (Milestone 2 input)

    specbridge-handoff-v1/
      README.md              # what this is, build order for Bob
      manifest.json          # doc types, versions, counts, target platform
      01-requirements/requirements.md
      02-blueprint/as-is.md
      02-blueprint/to-be-mapping.md
      03-fsd/fsd.md
      04-tsd/tsd.md
      05-ricef/RICEF-E-001.md
      06-context/glossary.md
      06-context/platform-context.md   # replaces maximo-context.md; platform-agnostic
      06-context/acceptance-criteria.md

**`RICEF-E-001.md` must be independently buildable.** Assume Bob reads this one file
with no memory of the others. Required fields:

- RICEF type and ID
- Linked requirement IDs, each with its transcript evidence span
- Target platform, app, and object (e.g. Maximo / WORKORDER, or ServiceNow / Incident)
- Launch-point type and trigger event
- Trigger condition (e.g. asset criticality from asset spec)
- Field-level detail: attribute names, data types, valid values
- Pseudo-logic, step by step
- Error handling and the non-happy path
- Dependencies and assumptions
- Testable acceptance criteria (Given/When/Then)
- **Deploy target:** API base URL placeholder, endpoint, HTTP method, auth scheme

**Acceptance test for this file:** paste it into a fresh Bob task with no other context.
If Bob asks a clarifying question, the file is incomplete — fix the generator prompt,
not the file by hand.

---

## 11. Build order — Bobcoin-aware

Each milestone leaves the app usable end-to-end for what exists so far. Commit after
each. Capture the task-session screenshot after each.

| # | Milestone | Bobcoin budget | Cumulative |
|---|---|---|---|
| 1 | **Foundation** — Vite+React shell, dark theme, tab nav (Inputs → Generation → Validation → Output), Context/reducer, IndexedDB, Vite proxy, `.gitignore`/`.bobignore`, `/init` + AGENTS.md | 4 | 4 |
| 2 | **Inputs** — DOCX/TXT/paste upload (mammoth.js), template upload with heading-tree detection, platform/module selector (Maximo, ServiceNow, SAP, Custom), project-context field, seeded transcript + seeded template | 5 | 9 |
| 3 | **AI foundation** — Generator + Validator config screens, watsonx adapter (IAM flow), OpenAI adapter, test-connection, model discovery + denylist, RU/token metrics in header | 6 | 15 |
| 4 | **Generation** — platform-aware prompt engine with RICEF taxonomy, streaming section-by-section, per-section regenerate, the PM→RICEF-E thread producing FSD+TSD | 8 | 23 |
| 5 | **Output & Handoff** — inline edit, DOCX export, handoff bundle as ZIP (includes deploy metadata placeholder) | 6 | 29 |
| — | **CHECKPOINT: the closed loop (Milestone 1) now works. Everything below is Milestone 2 and optional polish.** | | |
| 6 | **Validation** — Validator LLM, 5 criteria (Completeness, Platform Alignment, Consistency, Clarity, Bob Readiness), per-section pass/warn, missing-topics list | 4 | 33 |
| 7 | **Orchestrate agent** — Spec Review & Handoff Agent (Section 7) | 3 | 36 |
| 8 | **Polish & evidence** — metrics dashboard, README, `bob_sessions/` | 2 | 38 |
| — | Reserve for Milestone 2 (Role B deploy demo) and overruns | 2 | 40 |

**Bobcoin discipline:** if a milestone runs 50% over budget, stop, commit, and re-scope
before continuing. Use Plan mode for design conversations (cheaper) and Agent mode only
to execute.

---

## 12. Milestone 2 — Bob deploys to a target system

This milestone is a **live demo script**, not a build task. SpecBridge has already
produced `RICEF-E-001.md`. The following is what Bob does with it.

### What Bob receives

A new Bob task is opened with **no prior context**. The user pastes:

1. `RICEF-E-001.md` — the handoff bundle's RICEF file
2. A short deploy brief (example for Maximo):

```
Target system: IBM Maximo Application Suite
API base URL: https://<host>/maximo
Auth: API key header  maxauth: <KEY>
Deploy endpoint: POST /maximo/oslc/script
Confirm endpoint: GET /maximo/oslc/script/<scriptname>
```

### What Bob must do (Maximo example)

1. Read `RICEF-E-001.md` and extract: script name, target object (`WORKORDER`),
   launch-point type (`OBJECT`), trigger event (`SAVE`/`INIT`), Jython logic.
2. Write the Automation Script source (Jython) matching the pseudo-logic and
   acceptance criteria in the spec.
3. Assemble the Maximo OSLC payload:
   ```json
   {
     "autoscript": "<SCRIPTNAME>",
     "description": "...",
     "scriptlanguage": "jython",
     "status": "Active",
     "source": "<jython source>",
     "launchpoint": [ { "autoscript": "<SCRIPTNAME>", "launchpointname": "...",
       "objectname": "WORKORDER", "eventname": "SAVE" } ]
   }
   ```
4. POST to `/maximo/oslc/script` with the `maxauth` header.
5. Confirm with GET; report the resulting resource URL.
6. If POST fails (400/409), diagnose from the response body and retry once with
   the corrected payload. Do not ask the human.

### Same pattern, other platforms

| Platform | Deploy call |
|---|---|
| ServiceNow | `POST /api/now/table/sys_script` (Business Rules table) |
| SAP (via REST extension) | `POST /sap/opu/odata/sap/...` |
| Custom REST app | `POST /admin/scripts` or equivalent |

The RICEF file format is identical; only the deploy adapter changes. Bob adapts
to the target system from the deploy brief provided by the user.

### Contrast demo (important for judging)

Run two Bob sessions side by side:
- **Session A:** Bob receives `RICEF-E-001.md` + deploy brief → deploys with **zero
  clarifying questions**.
- **Session B:** Bob receives the raw transcript only → counts the questions Bob asks.

The delta is the measurable value of SpecBridge.

---

## 13. Impact metrics

Measure, do not assert. Capture a real before/after on the synthetic thread:

- **Time.** Before starting the build, hand-author the FSD section for this one
  enhancement and time it honestly. That is the baseline. Compare against wall-clock
  app-assisted time. One measured number beats an estimated range.
- **Traceability.** % of generated statements carrying a transcript evidence span.
  Target 100%. This is the metric that distinguishes the tool from a chatbot — show it
  in the UI as a live counter.
- **Rework.** Validator catches per document before Bob build, by criterion.
- **Clarification round trips.** Count the questions Bob asks when building from
  `RICEF-E-001.md`. Target: zero. Contrast with the count when Bob is given the raw
  transcript instead — run both, it is a compelling side-by-side.
- **End-to-end.** Conversation → deployed automation code, hands-off except approvals.
- **Platform breadth.** Show the same pipeline applied to at least one additional
  platform (even if only the prompt changes) to demonstrate generality.

---

## 14. Demo script

### Milestone 1 demo
1. Show the synthetic PM transcript. Click **Generate** — FSD/TSD stream in, evidence
   spans visible.
2. Click **Send for Review** — Orchestrate agent (or fallback Validator) returns scores
   and blockers.
3. Export the **handoff bundle**; open `RICEF-E-001.md`.

### Milestone 2 demo
4. Open a fresh Bob task. Paste `RICEF-E-001.md` + the Maximo deploy brief.
5. Bob writes the Automation Script and deploys it via `POST /maximo/oslc/script`
   with no clarifying questions. **This is the moment the submission turns on — rehearse it.**
6. Show the contrast: Bob given only the raw transcript → count the questions asked.
7. Show `bob_sessions/` screenshots as evidence.

Record the demo before the deadline, not on it. If the cloud account expires, a
recorded run is still evidence.

---

## 15. Submission checklist

- [ ] Repo with SpecBridge app (built by Bob in Milestone 1)
- [ ] `bob_sessions/` with task-session summary PNGs, named `<handle>_taskNN_<desc>.png`
- [ ] Handoff bundle + `RICEF-E-001.md` in repo (output of Milestone 1)
- [ ] Evidence of Milestone 2 deploy (Bob session screenshot, Maximo GET confirmation)
- [ ] README describing the two milestones, the closed loop, and the dev-proxy note
- [ ] Synthetic data only — transcript *and* DOCX template
- [ ] No keys committed; `.gitignore` and `.bobignore` present; repo scanned before push
- [ ] Built on `ibm-coding-challenge-uat (us-east)`, not personal Bob
- [ ] watsonx work on the `xxxxxxx - watsonx` cloud account, Dallas region
- [ ] No banned models used anywhere
- [ ] Measured baseline recorded for the time metric
- [ ] Contrast demo recorded (RICEF bundle vs raw transcript)
- [ ] Demo recorded (end-to-end, Milestone 1 + Milestone 2)
