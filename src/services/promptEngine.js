// SpecBridge — Platform-aware prompt engine
// Builds LLM prompts for each spec section based on platform + transcript.

// ─── Platform-specific context ────────────────────────────────────────────────

const PLATFORM_CONTEXT = {
  maximo: {
    name: 'IBM Maximo Application Suite (MAS Manage)',
    objects: ['WORKORDER', 'PM', 'ASSET', 'ASSETMETER', 'JOBPLAN', 'ASSETSPEC', 'PERSON', 'LOCATIONS'],
    launchPoints: ['Object launch point (eventtype "0" on create)', 'Attribute launch point', 'Action launch point', 'Custom condition'],
    scriptLanguages: ['Jython', 'Nashorn (JavaScript)'],
    ricefTypes: ['R - Report', 'I - Interface', 'C - Conversion', 'E - Enhancement', 'F - Form/Screen'],
    // Corrected per MAS-DEPLOY-RUNBOOK.md — /oslc/script is the runner endpoint,
    // mxapiautoscript is the management endpoint. Auth is OIDC, not apikey.
    deployHint: 'POST {BASE_ALL}/maximo/oslc/os/mxapiautoscript · Auth: OIDC session · Script name prefix: BOB_ · See MAS-DEPLOY-RUNBOOK.md',
  },
  servicenow: {
    name: 'ServiceNow',
    objects: ['Incident', 'Change', 'Problem', 'Task', 'Configuration Item (CI)', 'CMDB', 'User', 'Group'],
    launchPoints: ['Business Rule (before/after)', 'Script Include', 'Client Script', 'Scheduled Job'],
    scriptLanguages: ['Server-side JavaScript (GlideScript)', 'Client-side JavaScript'],
    ricefTypes: ['R - Report', 'I - Integration', 'C - Customization', 'E - Enhancement', 'F - Form'],
    deployHint: 'ServiceNow Table API: POST /api/now/table/sys_script',
  },
  sap: {
    name: 'SAP (S/4HANA)',
    objects: ['Equipment', 'Functional Location', 'Notification', 'Maintenance Order', 'Work Center'],
    launchPoints: ['User Exit', 'BADI Implementation', 'Enhancement Spot', 'Workflow Task'],
    scriptLanguages: ['ABAP', 'ABAP OO'],
    ricefTypes: ['R - Report', 'I - Interface', 'C - Conversion', 'E - Enhancement', 'F - Form (SmartForm/SAPScript)'],
    deployHint: 'SAP REST extension or transport via CTS',
  },
  custom: {
    name: 'Custom Application',
    objects: ['Entity', 'Record', 'Object', 'Resource'],
    launchPoints: ['Event handler', 'Webhook', 'Trigger', 'Hook'],
    scriptLanguages: ['Python', 'JavaScript/Node.js', 'Java', 'C#'],
    ricefTypes: ['R - Report', 'I - Interface', 'C - Conversion', 'E - Enhancement', 'F - Form'],
    deployHint: 'Custom REST API endpoint',
  },
};

// ─── System prompt base ───────────────────────────────────────────────────────

function systemPrompt(platform, projectContext) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return `You are SpecBridge, an SDLC accelerator that converts meeting transcripts into machine-buildable specification documents for ${ctx.name}.

Your outputs will be consumed directly by an AI coding agent (IBM Bob) to write and deploy automation code — NO human will edit your output. Every statement you generate MUST be:
1. Specific enough that a developer can implement it without asking any questions.
2. Traced back to the source transcript using the format: [Evidence: "<exact quote from transcript>"]
3. Structured using the RICEF taxonomy (R=Report, I=Interface, C=Conversion, E=Enhancement, F=Form).

Platform context:
- Platform: ${ctx.name}
- Key objects: ${ctx.objects.join(', ')}
- Launch points: ${ctx.launchPoints.join('; ')}
- Script languages: ${ctx.scriptLanguages.join(', ')}
- Deploy mechanism: ${ctx.deployHint}

${projectContext ? `Project context: ${projectContext}` : ''}

CRITICAL RULES:
- Never omit launch-point type, trigger condition, object name, or error path.
- Always include the evidence span in [Evidence: "..."] format.
- Never use vague language like "handle appropriately" or "as needed".
- If the transcript is ambiguous, state the ambiguity explicitly and choose the most conservative interpretation.
- Output in clean Markdown.`;
}

// ─── Section prompts ──────────────────────────────────────────────────────────

export function buildRequirementsPrompt(platform, transcript, projectContext) {
  return [
    { role: 'system', content: systemPrompt(platform, projectContext) },
    {
      role: 'user',
      content: `Extract all functional requirements from this meeting transcript.

For each requirement:
- Assign ID: REQ-001, REQ-002, etc.
- Write a clear, testable statement (one sentence)
- Identify the actor and trigger
- Add [Evidence: "<exact quote>"] tracing it to the transcript
- Mark priority: MUST / SHOULD / COULD

Output as a numbered Markdown list.

TRANSCRIPT:
---
${transcript}
---`,
    },
  ];
}

export function buildAsIsPrompt(platform, transcript, requirements, projectContext) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return [
    { role: 'system', content: systemPrompt(platform, projectContext) },
    {
      role: 'user',
      content: `Based on the transcript and requirements below, document the AS-IS (current state) process in ${ctx.name}.

For each AS-IS process step:
- Describe what currently happens (or is implied to be missing)
- Identify the relevant ${ctx.name} object/entity involved
- Note the pain point or gap
- Include [Evidence: "..."] where the transcript mentions current behavior

Format as a numbered process flow with a "Pain Points" section at the end.

REQUIREMENTS:
${requirements}

TRANSCRIPT:
---
${transcript}
---`,
    },
  ];
}

export function buildToBePrompt(platform, transcript, requirements, projectContext) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return [
    { role: 'system', content: systemPrompt(platform, projectContext) },
    {
      role: 'user',
      content: `Based on the transcript and requirements, document the TO-BE (future state) process mapping for ${ctx.name}.

For each TO-BE step:
- Describe the new automated behavior
- Map to the specific ${ctx.name} object/entity (e.g. ${ctx.objects[0]})
- Specify the trigger event
- Show before/after comparison
- Include [Evidence: "..."]

Format as a process flow table with columns: Step | Current State | Future State | ${ctx.name} Object | Trigger.

REQUIREMENTS:
${requirements}

TRANSCRIPT:
---
${transcript}
---`,
    },
  ];
}

export function buildFSDPrompt(platform, transcript, requirements, asIs, toBe, projectContext) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return [
    { role: 'system', content: systemPrompt(platform, projectContext) },
    {
      role: 'user',
      content: `Write a Functional Specification Document (FSD) for a ${ctx.name} enhancement.

## Required sections:
### 1. Overview
Brief description of the enhancement and its business value.

### 2. Scope
What is in scope and explicitly out of scope.

### 3. Functional Requirements
Restate each requirement with acceptance criteria in Given/When/Then format.

### 4. Business Rules
All conditional logic with exact field names and valid values.

### 5. User Interface Changes (if any)
Any UI modifications needed.

### 6. Error Handling
Every error condition, what triggers it, and what the system does.

### 7. Assumptions and Dependencies
Explicit assumptions and dependencies on other objects/systems.

For every statement, include [Evidence: "..."] tracing it to the transcript.

REQUIREMENTS:
${requirements}

AS-IS:
${asIs}

TO-BE:
${toBe}

TRANSCRIPT:
---
${transcript}
---`,
    },
  ];
}

export function buildTSDPrompt(platform, transcript, fsd, projectContext) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return [
    { role: 'system', content: systemPrompt(platform, projectContext) },
    {
      role: 'user',
      content: `Write a Technical Specification Document (TSD) for this ${ctx.name} enhancement.

## Required sections:
### 1. Technical Approach
Which ${ctx.name} mechanism is used (e.g. ${ctx.launchPoints[0]}) and why.

### 2. Object / Entity Details
- Target object: (e.g. ${ctx.objects[0]})
- Launch point type: 
- Trigger event: (SAVE / INIT / etc.)
- Trigger condition (exact logic):

### 3. Field-Level Specification
Table: Field Name | Data Type | Valid Values | Source | Required?

### 4. Pseudo-Logic (Step-by-Step)
Numbered steps that a developer can translate directly to ${ctx.scriptLanguages[0]}.

### 5. Error Handling and Non-Happy Path
Every exception case with exact behavior.

### 6. Integration Points
Any external system calls, notifications, or data reads.

### 7. Testing Requirements
Unit test cases in Given/When/Then format.

### 8. Performance Considerations
Any limits or performance implications.

Include [Evidence: "..."] for every design decision traceable to the transcript.

FSD:
${fsd}

TRANSCRIPT:
---
${transcript}
---`,
    },
  ];
}

export function buildRICEFPrompt(platform, transcript, requirements, fsd, tsd, projectContext) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return [
    { role: 'system', content: systemPrompt(platform, projectContext) },
    {
      role: 'user',
      content: `Generate RICEF-E-001.md — a standalone, independently buildable RICEF Enhancement specification for ${ctx.name}.

This file MUST be complete enough that an AI coding agent can implement and deploy the enhancement with ZERO clarifying questions.

Required fields (do not skip any):

# RICEF-E-001: [Title]

## Metadata
- RICEF Type: E (Enhancement)
- RICEF ID: RICEF-E-001
- Target Platform: ${ctx.name}
- Target App/Module: 
- Target Object: (e.g. ${ctx.objects[0]})
- Priority: HIGH
- Status: Draft

## Linked Requirements
(Each REQ-NNN with its transcript evidence span)

## Functional Summary
One paragraph. What this enhancement does and why.

## Technical Specification

### Launch Point
- Type: (e.g. Object launch point)
- Object: 
- Event: (SAVE / INIT / DELETE)
- Active: Yes

### Trigger Condition
Exact conditional logic in pseudocode.

### Field-Level Detail
Table: Field | Object | Data Type | Valid Values | Read/Write | Source

### Pseudo-Logic (Step by Step)
Numbered steps that translate directly to ${ctx.scriptLanguages[0]}.

### Error Handling
Every error case with exact behavior.

### Notification/Side Effects
Any email, status change, or external call.

## Dependencies and Assumptions
Explicit list.

## Acceptance Criteria (Given/When/Then)
At least 3 test scenarios.

## Deploy Target
\`\`\`
Platform: ${ctx.name}
API Base URL: <PLACEHOLDER — provide at deploy time>
Deploy endpoint: ${ctx.deployHint}
Auth scheme: <API key / Basic — provide at deploy time>
Script language: ${ctx.scriptLanguages[0]}
\`\`\`

## Evidence Index
Map each design decision to its transcript quote.

Include [Evidence: "..."] inline throughout.

REQUIREMENTS:
${requirements}

FSD:
${fsd}

TSD:
${tsd}

TRANSCRIPT:
---
${transcript}
---`,
    },
  ];
}

// ─── Validation prompt ────────────────────────────────────────────────────────

export function buildValidationPrompt(platform, ricef, fsd, tsd) {
  const ctx = PLATFORM_CONTEXT[platform] || PLATFORM_CONTEXT.custom;
  return [
    { role: 'system', content: `You are a senior ${ctx.name} developer and spec reviewer. You are strict, precise, and care deeply about whether an AI coding agent can build from the spec with zero questions.` },
    {
      role: 'user',
      content: `Review this specification package and score it on 5 criteria.

For each criterion, provide:
- Score: PASS / WARN / FAIL
- Numeric score: 0-100
- Specific feedback (what is missing, ambiguous, or incorrect)
- Blocker flag: true/false

## Criteria:
1. **Completeness** — Are all required fields present? Launch point, trigger condition, field details, error handling?
2. **Platform Alignment** — Are ${ctx.name} objects, events, and field names correct and valid?
3. **Consistency** — Do FSD, TSD, and RICEF agree with each other and the requirements?
4. **Clarity** — Can a developer implement this with zero clarifying questions?
5. **Bob Readiness** — Is RICEF-E-001.md independently buildable? Does it have the deploy target section?

Respond with ONLY a single valid JSON object matching the shape below — no markdown code fence, no headings, no commentary before or after it. Keep every "feedback" value to one short plain-text sentence (under 25 words) with no line breaks inside the string.

{
  "criteria": [
    { "name": "Completeness", "status": "PASS|WARN|FAIL", "score": 0-100, "feedback": "...", "blocker": true|false },
    { "name": "Platform Alignment", "status": "PASS|WARN|FAIL", "score": 0-100, "feedback": "...", "blocker": true|false },
    { "name": "Consistency", "status": "PASS|WARN|FAIL", "score": 0-100, "feedback": "...", "blocker": true|false },
    { "name": "Clarity", "status": "PASS|WARN|FAIL", "score": 0-100, "feedback": "...", "blocker": true|false },
    { "name": "Bob Readiness", "status": "PASS|WARN|FAIL", "score": 0-100, "feedback": "...", "blocker": true|false }
  ],
  "overall": "PASS|FAIL",
  "blockers": ["list of blocking issues"],
  "warnings": ["list of non-blocking warnings"],
  "missing_topics": ["topics not covered that should be"]
}

RICEF-E-001.md:
${ricef}

FSD:
${fsd}

TSD:
${tsd}`,
    },
  ];
}

export { PLATFORM_CONTEXT };
