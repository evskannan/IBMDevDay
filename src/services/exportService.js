// SpecBridge — Handoff bundle export service
// Assembles the specbridge-handoff-v1/ ZIP and DOCX files.

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// ─── Handoff bundle (ZIP) ─────────────────────────────────────────────────────

export async function exportHandoffBundle({ project, sections }) {
  const zip = new JSZip();
  const root = 'specbridge-handoff-v1';
  const ts = new Date().toISOString().slice(0, 10);

  const manifest = {
    name: 'SpecBridge Handoff Bundle',
    version: '1',
    generated: new Date().toISOString(),
    platform: project.platform,
    project: project.name,
    documents: [
      'requirements.md',
      'as-is.md',
      'to-be-mapping.md',
      'fsd.md',
      'tsd.md',
      'RICEF-E-001.md',
      'glossary.md',
      'platform-context.md',
      'acceptance-criteria.md',
    ],
  };

  // Bundle README
  const bundleReadme = `# SpecBridge Handoff Bundle

Generated: ${new Date().toISOString()}
Platform: ${project.platform}
Project: ${project.name}

## Build order for Bob

1. Read \`05-ricef/RICEF-E-001.md\` — this file is independently buildable.
2. For context, read \`03-fsd/fsd.md\` and \`04-tsd/tsd.md\`.
3. Receive the deploy brief from the user (API URL + credentials).
4. Write and deploy the automation script using the deploy target section in RICEF-E-001.md.
5. Confirm deployment with the Confirm endpoint.
6. If POST fails (400/409), diagnose from the response body and retry once. Do NOT ask the human.

## Acceptance test
If Bob asks a clarifying question after reading RICEF-E-001.md, the spec is incomplete — do not patch the file by hand, fix the generator.
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
    maximo: `# Platform Context — IBM Maximo Application Suite

## Key Objects
- WORKORDER — Work order record
- PM — Preventive Maintenance schedule
- ASSET — Physical asset
- ASSETSPEC — Asset specification (holds criticality field)
- PERSON — Person record (planner)

## Automation Script Mechanism
- Launch Point Types: Object, Attribute, Action, Custom Condition
- Languages: Jython, Nashorn
- Deploy API: POST /maximo/oslc/script

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
