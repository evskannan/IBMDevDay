// SpecBridge — Handoff bundle export service
// Assembles the specbridge-handoff-v1/ ZIP and DOCX files.

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// ─── MAS Deploy Runbook — verbatim content ────────────────────────────────────
// Included in every Maximo bundle so Bob reads it at deploy time.
// This is hard-won institutional knowledge: OIDC auth, correct endpoint,
// BOB_ prefix, draft→activate two-step, eventtype "0" not "INIT".

const MAS_DEPLOY_RUNBOOK = `# IBM MAS Manage — Automation Script Deploy Runbook

> Generic, reusable. Works for any Automation Script + Object Launch Point.

---

## URLs

| Variable | Pattern |
|----------|---------|
| \`AUTH\` | \`https://auth.<domain>\` |
| \`BASE\` | \`https://<tenant>.manage.<domain>\` |
| \`BASE_ALL\` | \`https://<tenant>-all.manage.<domain>\` ← **use this for all API calls** |

> \`BASE_ALL\` is not obvious — it appears in error response URLs. Always use it for REST, not \`BASE\`.

---

## Authentication

OIDC only. No \`apikey\` header. No \`/maximo/api/v1\` (always 500). No shortcuts.

\`\`\`python
import requests, pickle

session = requests.Session()

# 1. Collect OIDC state cookies
session.get(f"{BASE}/maximo/oslc/whoami", allow_redirects=False)

# 2. Follow authorize → /login chain
r = session.get(f"{AUTH}/oidc/endpoint/MaximoAppSuite/authorize"
                f"?scope=openid&response_type=code&client_id=manage"
                f"&redirect_uri={BASE}/oidcclient/redirect/oidc",
                allow_redirects=False)
loc = r.headers.get("Location", "")
session.get(loc if loc.startswith("http") else f"{AUTH}{loc}", allow_redirects=False)

# 3. POST credentials
r = session.post(f"{AUTH}/j_security_check",
    data={"j_username": USERNAME, "j_password": PASSWORD},
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    allow_redirects=False)

# 4. Complete code exchange
session.get(r.headers["Location"], allow_redirects=True)

# Verify
assert session.get(f"{BASE_ALL}/maximo/oslc/whoami?lean=1",
    headers={"Accept": "application/json"}, allow_redirects=False).status_code == 200

# Save / restore
pickle.dump(session.cookies, open("/tmp/mas_session.pkl", "wb"))
# session.cookies.update(pickle.load(open("/tmp/mas_session.pkl", "rb")))
\`\`\`

---

## Deploy Script

**Endpoint:** \`POST {BASE_ALL}/maximo/oslc/os/mxapiautoscript\`

\`\`\`python
r = session.post(
    f"{BASE_ALL}/maximo/oslc/os/mxapiautoscript",
    json={
        "autoscript":     "BOB_<NAME>",          # Bob_ prefix mandatory
        "description":    "<description>",
        "scriptlanguage": "jython",
        "version":        "1.0",
        "source":         open("script.py").read()
        # ← NO "status" field on create
    },
    headers={"Accept": "application/json", "Content-Type": "application/json"},
    allow_redirects=False
)
assert r.status_code == 201
\`\`\`

**Activate** (created as Draft — must patch separately):

\`\`\`python
script_href = session.get(
    f"{BASE_ALL}/maximo/oslc/os/mxapiautoscript?lean=1"
    "&oslc.where=autoscript%3D%22BOB_<NAME>%22&oslc.select=href",
    headers={"Accept": "application/json"}, allow_redirects=False
).json()["member"][0]["href"]

session.post(script_href, json={"status": "Active"},
    headers={"Accept": "application/json", "Content-Type": "application/json",
             "x-method-override": "PATCH", "patchtype": "MERGE"},
    allow_redirects=False)
\`\`\`

---

## Create Launch Point

**PATCH the script href** with an embedded \`scriptlaunchpoint\` array.

\`\`\`python
# Create (eventtype "0" = INIT is the only valid string on create)
session.post(script_href,
    json={"scriptlaunchpoint": [{
        "launchpointname": "BOB_<NAME>_LP",
        "description":     "<description>",
        "launchpointtype": "OBJECT",
        "objectname":      "<MBONAME>",    # e.g. WORKORDER
        "active":          True,
        "eventtype":       "0"             # ← must be "0", not "INIT" or "INITSAVE"
    }]},
    headers={"Accept": "application/json", "Content-Type": "application/json",
             "x-method-override": "PATCH", "patchtype": "MERGE"},
    allow_redirects=False)

# Enable SAVE event (add = INIT, update = SAVE)
lp_localref = session.get(f"{script_href}/scriptlaunchpoint?lean=1",
    headers={"Accept": "application/json"}, allow_redirects=False
).json()["member"][0]["localref"]

session.post(lp_localref,
    json={"launchpointname": "BOB_<NAME>_LP", "add": True, "update": True},
    headers={"Accept": "application/json", "Content-Type": "application/json",
             "x-method-override": "PATCH", "patchtype": "MERGE"},
    allow_redirects=False)
\`\`\`

---

## Verify

\`\`\`python
s = session.get(f"{script_href}?lean=1", headers={"Accept":"application/json"}, allow_redirects=False).json()
print(s["autoscript"], s.get("status_description") or s.get("status"))  # → BOB_<NAME>  Active

lp = session.get(f"{lp_localref}?lean=1", headers={"Accept":"application/json"}, allow_redirects=False).json()
print(lp["launchpointname"], lp["objectname"], lp["add"], lp["update"])  # → BOB_<NAME>_LP  <OBJ>  True  True
\`\`\`

---

## Quick-Fail Reference

| Error | Cause | Fix |
|-------|-------|-----|
| \`302\` on \`/maximo/oslc/*\` | No session | Complete auth flow first |
| \`500 BMXAA1649E\` | \`/maximo/api/v1\` is broken on this instance | Never use it — use \`/oslc/os/mxapiautoscript\` |
| \`400 BMXAA9260E\` | Used \`/maximo/oslc/script\` (runner, not manager) | Use \`/oslc/os/mxapiautoscript\` |
| \`400 BMXAA4190E\` | Sent \`"status"\` on create | Omit on create; PATCH after |
| \`400 BMXAA4049E\` | \`eventtype\` = \`"INIT"\` / \`"SAVE"\` / \`"INITSAVE"\` | Use \`"0"\` only |
| \`400 BMXAA1339E\` | LP PATCH missing \`launchpointname\` key | Always include it in every LP PATCH |
`;

// ─── Handoff bundle (ZIP) ─────────────────────────────────────────────────────

export async function exportHandoffBundle({ project, sections }) {
  const zip = new JSZip();
  const root = 'specbridge-handoff-v1';
  const ts = new Date().toISOString().slice(0, 10);
  const isMaximo = project.platform === 'maximo';

  const documents = [
    'requirements.md',
    'as-is.md',
    'to-be-mapping.md',
    'fsd.md',
    'tsd.md',
    'RICEF-E-001.md',
    'glossary.md',
    'platform-context.md',
    'acceptance-criteria.md',
  ];
  if (isMaximo) documents.push('MAS-DEPLOY-RUNBOOK.md');

  const manifest = {
    name: 'SpecBridge Handoff Bundle',
    version: '1',
    generated: new Date().toISOString(),
    platform: project.platform,
    project: project.name,
    documents,
  };

  // Bundle README — build order references runbook when platform is Maximo
  const runbookNote = isMaximo
    ? `3. **Read \`06-context/MAS-DEPLOY-RUNBOOK.md\` before writing any deploy code.**
   This runbook contains the exact MAS OIDC auth flow, correct API endpoint
   (\`/oslc/os/mxapiautoscript\`, NOT \`/oslc/script\`), \`BOB_\` script name prefix,
   draft→activate two-step, and \`eventtype "0"\` requirement.
   Ignore it and you will hit BMXAA errors.`
    : `3. Receive the deploy brief from the user (API URL + credentials).`;

  const bundleReadme = `# SpecBridge Handoff Bundle

Generated: ${new Date().toISOString()}
Platform: ${project.platform}
Project: ${project.name}

## Build order for Bob

1. Read \`05-ricef/RICEF-E-001.md\` — this file is independently buildable.
2. For context, read \`03-fsd/fsd.md\` and \`04-tsd/tsd.md\`.
${runbookNote}
4. Write and deploy the automation script exactly as described in the runbook / deploy target section.
5. Confirm deployment with GET on the script href. Verify status = Active and launch point active = True.
6. If any step fails, diagnose from the error code table in the runbook and retry once. Do NOT ask the human.

## Acceptance test
If Bob asks a clarifying question after reading RICEF-E-001.md, the spec is incomplete — fix the generator, not the file.
`;

  zip.file(`${root}/README.md`, bundleReadme);
  zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));

  // Requirements
  zip.file(`${root}/01-requirements/requirements.md`, sections.requirements.text || '# Requirements\n\n(Not yet generated)');

  // Blueprint
  zip.file(`${root}/02-blueprint/as-is.md`, sections.asIs.text || '# AS-IS State\n\n(Not yet generated)');
  zip.file(`${root}/02-blueprint/to-be-mapping.md`, sections.toBe.text || '# TO-BE Mapping\n\n(Not yet generated)');

  // FSD
  zip.file(`${root}/03-fsd/fsd.md`, sections.fsd.text || '# Functional Specification Document\n\n(Not yet generated)');

  // TSD
  zip.file(`${root}/04-tsd/tsd.md`, sections.tsd.text || '# Technical Specification Document\n\n(Not yet generated)');

  // RICEF
  zip.file(`${root}/05-ricef/RICEF-E-001.md`, sections.ricef.text || buildEmptyRICEF(project.platform));

  // Context
  zip.file(`${root}/06-context/glossary.md`, buildGlossary(project.platform));
  zip.file(`${root}/06-context/platform-context.md`, buildPlatformContext(project.platform));
  zip.file(`${root}/06-context/acceptance-criteria.md`, buildAcceptanceCriteria(sections));
  if (isMaximo) {
    zip.file(`${root}/06-context/MAS-DEPLOY-RUNBOOK.md`, MAS_DEPLOY_RUNBOOK);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `specbridge-handoff-${project.name.replace(/\s+/g, '-').toLowerCase()}-${ts}.zip`);
}

// ─── DOCX export ──────────────────────────────────────────────────────────────

export async function exportDocx({ templateBuffer, sections, project }) {
  if (!templateBuffer) {
    throw new Error('No DOCX template loaded. Please upload a template in the Inputs tab.');
  }

  const pz = new PizZip(templateBuffer);
  const doc = new Docxtemplater(pz, {
    paragraphLoop: true,
    linebreaks: true,
    errorLogging: false,
  });

  doc.render({
    project_name: project.name,
    platform: project.platform,
    generated_date: new Date().toLocaleDateString(),
    requirements: sections.requirements.text,
    as_is: sections.asIs.text,
    to_be: sections.toBe.text,
    fsd: sections.fsd.text,
    tsd: sections.tsd.text,
    ricef: sections.ricef.text,
  });

  const out = doc.getZip().generate({ type: 'blob' });
  const ts = new Date().toISOString().slice(0, 10);
  saveAs(out, `specbridge-fsd-tsd-${project.name.replace(/\s+/g, '-').toLowerCase()}-${ts}.docx`);
}

// ─── Fallback content builders ────────────────────────────────────────────────

function buildEmptyRICEF(platform) {
  return `# RICEF-E-001: [Enhancement Title]

## Metadata
- RICEF Type: E (Enhancement)
- RICEF ID: RICEF-E-001
- Target Platform: ${platform}
- Status: Draft — NOT YET GENERATED

## Note
Run SpecBridge generation pipeline to populate this file.
`;
}

function buildGlossary(platform) {
  const glossaries = {
    maximo: `# Glossary — Maximo

| Term | Definition |
|---|---|
| WORKORDER | Maximo work order object |
| PM | Preventive Maintenance record |
| ASSET | Physical asset record |
| ASSETSPEC | Asset specification attributes |
| RICEF | Report, Interface, Conversion, Enhancement, Form |
| Launch Point | Automation Script trigger mechanism |
| OSLC | Open Services for Lifecycle Collaboration — Maximo REST API protocol |
`,
    servicenow: `# Glossary — ServiceNow

| Term | Definition |
|---|---|
| Incident | ITSM incident record |
| CI | Configuration Item |
| Business Rule | Server-side script triggered on table events |
| GlideScript | ServiceNow server-side JavaScript API |
`,
    sap: `# Glossary — SAP

| Term | Definition |
|---|---|
| Equipment | SAP plant maintenance equipment master |
| Notification | SAP maintenance notification |
| BADI | Business Add-In — SAP enhancement technique |
`,
    custom: `# Glossary

| Term | Definition |
|---|---|
| RICEF | Report, Interface, Conversion, Enhancement, Form |
| Enhancement | A code-based modification to existing system behavior |
`,
  };
  return glossaries[platform] || glossaries.custom;
}

function buildPlatformContext(platform) {
  const contexts = {
    maximo: `# Platform Context — IBM Maximo Application Suite (MAS Manage)

## Key Objects
- WORKORDER — Work order record
- PM — Preventive Maintenance schedule
- ASSET — Physical asset
- ASSETSPEC — Asset specification (holds criticality field)
- PERSON — Person record (planner)

## Automation Script Mechanism
- Launch Point Types: Object, Attribute, Action, Custom Condition
- Languages: Jython, Nashorn
- Script name prefix: BOB_ (mandatory on this instance)
- Deploy API: POST {BASE_ALL}/maximo/oslc/os/mxapiautoscript
  - NOT /maximo/oslc/script (returns BMXAA9260E — runner, not manager)
  - NOT /maximo/api/v1 (always returns 500 on MAS Manage)
- Auth: OIDC session (not apikey header) — see MAS-DEPLOY-RUNBOOK.md
- Scripts are created as Draft — must PATCH status="Active" separately
- Launch point eventtype must be "0" on create (not "INIT" or "INITSAVE")
- Full tested deploy procedure: 06-context/MAS-DEPLOY-RUNBOOK.md

## Common Patterns
- Read asset criticality: mbo.getRelatedMbo("ASSET").getString("CRITICALITY")
- Set work order priority: mbo.setValue("WOPRIORITY", 1)
- Send email: MXServer.getMXServer().lookup("EMAILSTOP").sendMail(...)
`,
    servicenow: `# Platform Context — ServiceNow

## Key Tables
- incident — Incident records
- sys_script — Business Rules
- cmdb_ci — Configuration Items

## Business Rule Mechanism
- Trigger: before/after insert/update/delete
- Script field contains GlideScript
- Deploy: POST /api/now/table/sys_script
`,
    sap: `# Platform Context — SAP

## Key Objects
- Equipment master (IE01/IE02)
- Maintenance Notification (IW21)
- Maintenance Order (IW31)

## Enhancement Mechanism
- BADI implementations
- Enhancement spots
- Deploy via transport CTS
`,
    custom: `# Platform Context — Custom Application

Document your platform-specific context here.
`,
  };
  return contexts[platform] || contexts.custom;
}

function buildAcceptanceCriteria(sections) {
  // Extract Given/When/Then blocks from RICEF
  const ricef = sections.ricef.text || '';
  const gwtBlocks = ricef.match(/(?:Given|GIVEN)[^\n]*\n(?:(?:When|WHEN|And|AND)[^\n]*\n)*(?:Then|THEN)[^\n]*/g) || [];

  let content = `# Acceptance Criteria\n\nExtracted from RICEF-E-001.md\n\n`;
  if (gwtBlocks.length > 0) {
    gwtBlocks.forEach((block, i) => {
      content += `## Scenario ${i + 1}\n\`\`\`\n${block}\n\`\`\`\n\n`;
    });
  } else {
    content += `*No Given/When/Then blocks found. Ensure the RICEF spec includes acceptance criteria.*\n`;
  }
  return content;
}
