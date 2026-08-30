# SpecBridge — Project Context for Bob

## What this project is
SpecBridge is a browser-only SDLC accelerator. It converts meeting transcripts into
machine-buildable specification bundles that Bob can consume to deploy automation code
on any target platform (Maximo, ServiceNow, SAP, Custom REST).

## Tech Stack
- Vite 5 + React 18 (SPA, no SSR)
- Vanilla CSS with CSS custom properties
- mammoth.js — DOCX/TXT parsing
- docxtemplater + PizZip + FileSaver — DOCX generation
- JSZip — handoff bundle ZIP export
- lucide-react — icons
- IndexedDB (idb-style via raw IDBFactory) + localStorage — persistence
- Native fetch with SSE streaming — LLM calls

## Key architectural decisions
1. **No backend.** The Vite dev-server proxy (`/ibm-iam`, `/watsonx`) handles CORS.
   The app itself never runs server code.
2. **Two LLM providers:** watsonx.ai (default, IAM two-step auth) and OpenAI-compatible
   (fallback). Both implement the same `LLMProvider` interface.
3. **State:** React Context + useReducer. Persisted to IndexedDB on every dispatch.
4. **Handoff bundle:** ZIP exported to the user's Downloads folder. Contains RICEF-E-001.md
   independently buildable by Bob with no additional context.

## Naming
- App: SpecBridge
- Handoff bundle root: `specbridge-handoff-v1/`
- No references to MaximoForge anywhere

## Running locally
```
cd specbridge
npm install
npm run dev
# Open http://localhost:5173
```

## Security rules (enforced by .gitignore and .bobignore)
- No API keys in source. Keys live only in localStorage, clearable from Settings UI.
- No .env files committed.
- No real client data — synthetic samples only.
