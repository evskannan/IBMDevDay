# SpecBridge
## SDLC Accelerator — IBM Bob Hackathon Submission

**SpecBridge** eliminates the spec-ambiguity round trip that blocks developers across
any target platform (Maximo, ServiceNow, SAP, Custom REST).

---

### What it does

Converts a meeting transcript → structured, machine-buildable spec bundle →
Bob deploys code to the target platform, with zero clarifying questions.

```
Meeting transcript
  → Requirements (with evidence spans)
  → AS-IS / TO-BE mapping
  → FSD + TSD
  → RICEF-E-001.md (Bob-ready handoff file)
  → Bob + target API → deployed automation code
```

---

### Quick Start

```bash
cd specbridge
npm install
npm run dev
# Open http://localhost:5173
```

**No backend required.** The Vite dev-server proxy handles CORS for IBM IAM and
watsonx.ai endpoints. This is a browser-only SPA — no server code ships with it.

---

### Milestone 1 — Run SpecBridge

1. Open the **Inputs** tab.
2. Click **Load Demo** to load the synthetic EAGLE Utilities transcript.
3. Go to **Settings** → configure your watsonx.ai credentials (Project ID + API Key).
4. Go to **Generation** → click **Generate All Sections**.
5. Watch FSD/TSD/RICEF stream in with evidence spans.
6. Go to **Output** → export the **Handoff Bundle (.zip)**.

### Milestone 2 — Bob Deploys

Open a fresh Bob task. Paste:
1. `RICEF-E-001.md` from the ZIP
2. A deploy brief:

```
Target system: IBM Maximo Application Suite
API base URL: https://<host>/maximo
Auth: API key header  maxauth: <KEY>
Deploy endpoint: POST /maximo/oslc/script
Confirm endpoint: GET /maximo/oslc/script/<scriptname>
```

Bob writes and deploys the Jython Automation Script with zero clarifying questions.

---

### Architecture

| Layer | Technology |
|---|---|
| Framework | Vite 5 + React 18 |
| Styling | Vanilla CSS + custom properties |
| DOCX parse | mammoth.js |
| DOCX write | docxtemplater + PizZip + FileSaver |
| ZIP export | JSZip |
| LLM calls | Native fetch (SSE streaming) |
| State | React Context + useReducer |
| Storage | IndexedDB + localStorage |

### Dev-server proxy note (for judges)

The Vite config maps `/ibm-iam` and `/watsonx` to IBM Cloud endpoints.
**This is a development convenience, not an application backend.**
The app itself runs entirely in the browser; the proxy only exists while
`npm run dev` is running.

### Security

- API keys live in `localStorage` only, clearable from the Settings UI.
- No keys committed to code. `.gitignore` and `.bobignore` are both present.
- Synthetic data only — no real client records.

### Platforms supported

| Platform | Deploy mechanism |
|---|---|
| IBM Maximo | `POST /maximo/oslc/script` |
| ServiceNow | `POST /api/now/table/sys_script` |
| SAP | REST extension / transport |
| Custom | Configurable endpoint |

---

*Built with IBM Bob 2.0 · IBM TechXchange 2026 Hackathon*
