// SpecBridge — Generation orchestration service
// Calls the prompt engine + LLM provider, streams results, updates app state.

import { watsonxGenerate } from './watsonxProvider';
import { openaiGenerate } from './openaiProvider';
import {
  buildRequirementsPrompt,
  buildAsIsPrompt,
  buildToBePrompt,
  buildFSDPrompt,
  buildTSDPrompt,
  buildRICEFPrompt,
  buildValidationPrompt,
} from './promptEngine';
import { saveConfig } from './db';

// ─── Resolve provider ─────────────────────────────────────────────────────────

function getGenerateFunc(role, llmConfig) {
  const cfg = llmConfig[role];
  if (cfg.provider === 'watsonx') {
    return (args) => watsonxGenerate({ ...args, config: cfg.watsonx });
  }
  return (args) => openaiGenerate({ ...args, config: cfg.openai });
}

// ─── Count evidence spans ──────────────────────────────────────────────────────

function countEvidence(text) {
  const matches = text.match(/\[Evidence:/g) || [];
  // Total "statements" is a rough sentence count
  const sentences = text.split(/[.!?]\s+/).filter((s) => s.trim().length > 20).length;
  return { traceCount: matches.length, totalCount: Math.max(sentences, matches.length) };
}

// ─── Cost calculation helper ──────────────────────────────────────────────────
// IBM docs: 1,000 tokens = 1 RU = $0.0001 USD
// https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-tokens.html

export function calcCost(totalTokens) {
  const ru = totalTokens / 1000;
  const usd = ru * 0.0001;
  return { ru, usd };
}

// ─── Stream a single section ──────────────────────────────────────────────────

async function streamSection({ key, messages, dispatch, llmConfig, role, signal, currentMetrics }) {
  dispatch({ type: 'UPDATE_SECTION', payload: { key, updates: { status: 'streaming', text: '' } } });

  let accumulated = '';
  let sectionInput = 0;
  let sectionOutput = 0;

  const generate = getGenerateFunc(role, llmConfig);

  await generate({
    messages,
    signal,
    onToken: (token) => {
      accumulated += token;
      const { traceCount, totalCount } = countEvidence(accumulated);
      dispatch({
        type: 'UPDATE_SECTION',
        payload: { key, updates: { text: accumulated, status: 'streaming', traceCount, totalCount } },
      });
    },
    onDone: (usage) => {
      sectionInput  = usage?.inputTokens    || 0;
      sectionOutput = usage?.generatedTokens || 0;
    },
  });

  const { traceCount, totalCount } = countEvidence(accumulated);
  dispatch({
    type: 'UPDATE_SECTION',
    payload: { key, updates: { text: accumulated, status: 'done', traceCount, totalCount } },
  });

  // Dispatch a live cost update after every section completes
  const newInput  = (currentMetrics?.inputTokens  || 0) + sectionInput;
  const newOutput = (currentMetrics?.outputTokens || 0) + sectionOutput;
  const newTotal  = newInput + newOutput;
  const { ru, usd } = calcCost(newTotal);
  dispatch({
    type: 'UPDATE_METRICS',
    payload: {
      inputTokens:  newInput,
      outputTokens: newOutput,
      totalTokens:  newTotal,
      totalRU:      ru,
      totalCostUSD: usd,
    },
  });

  return { text: accumulated, inputTokens: sectionInput, generatedTokens: sectionOutput };
}

// ─── Main generation pipeline ─────────────────────────────────────────────────

export async function runGeneration({ state, dispatch, signal }) {
  const { transcript, project, llmConfig } = state;
  const platform = project.platform || 'maximo';
  const context = project.context || '';
  const text = transcript.text;

  if (!text.trim()) {
    dispatch({ type: 'SET_GENERATION_ERROR', payload: 'No transcript text. Please upload or paste a transcript first.' });
    return;
  }

  dispatch({ type: 'SET_GENERATING', payload: true });
  dispatch({ type: 'RESET_SECTIONS' });
  // Reset cost counters at start of a fresh pipeline run
  dispatch({ type: 'UPDATE_METRICS', payload: { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalRU: 0, totalCostUSD: 0 } });

  // We pass a live metrics reference so each section accumulates on top of the previous.
  // Because dispatch is async, we track running totals locally and pass them in.
  let runningInput = 0;
  let runningOutput = 0;

  const getRunningMetrics = () => ({ inputTokens: runningInput, outputTokens: runningOutput });

  try {
    // Step 1: Requirements
    const reqResult = await streamSection({
      key: 'requirements',
      messages: buildRequirementsPrompt(platform, text, context),
      dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: getRunningMetrics(),
    });
    runningInput  += reqResult.inputTokens;
    runningOutput += reqResult.generatedTokens;

    if (signal?.aborted) return;

    // Step 2a: AS-IS
    const asIsResult = await streamSection({
      key: 'asIs',
      messages: buildAsIsPrompt(platform, text, reqResult.text, context),
      dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: getRunningMetrics(),
    });
    runningInput  += asIsResult.inputTokens;
    runningOutput += asIsResult.generatedTokens;

    if (signal?.aborted) return;

    // Step 2b: TO-BE
    const toBeResult = await streamSection({
      key: 'toBe',
      messages: buildToBePrompt(platform, text, reqResult.text, context),
      dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: getRunningMetrics(),
    });
    runningInput  += toBeResult.inputTokens;
    runningOutput += toBeResult.generatedTokens;

    if (signal?.aborted) return;

    // Step 3: FSD
    const fsdResult = await streamSection({
      key: 'fsd',
      messages: buildFSDPrompt(platform, text, reqResult.text, asIsResult.text, toBeResult.text, context),
      dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: getRunningMetrics(),
    });
    runningInput  += fsdResult.inputTokens;
    runningOutput += fsdResult.generatedTokens;

    if (signal?.aborted) return;

    // Step 4: TSD
    const tsdResult = await streamSection({
      key: 'tsd',
      messages: buildTSDPrompt(platform, text, fsdResult.text, context),
      dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: getRunningMetrics(),
    });
    runningInput  += tsdResult.inputTokens;
    runningOutput += tsdResult.generatedTokens;

    if (signal?.aborted) return;

    // Step 5: RICEF-E-001
    const ricefResult = await streamSection({
      key: 'ricef',
      messages: buildRICEFPrompt(platform, text, reqResult.text, fsdResult.text, tsdResult.text, context),
      dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: getRunningMetrics(),
    });
    runningInput  += ricefResult.inputTokens;
    runningOutput += ricefResult.generatedTokens;

    // streamSection already dispatched the final metrics after the last section.
    // Nothing more to dispatch here.

    dispatch({ type: 'SET_GENERATING', payload: false });
  } catch (err) {
    if (err?.name === 'AbortError') {
      dispatch({ type: 'SET_GENERATING', payload: false });
      return;
    }
    dispatch({ type: 'SET_GENERATION_ERROR', payload: err.message });
  }
}

// ─── Regenerate a single section ──────────────────────────────────────────────

export async function regenerateSection({ key, state, dispatch, signal }) {
  const { transcript, project, sections, llmConfig } = state;
  const platform = project.platform || 'maximo';
  const context = project.context || '';
  const text = transcript.text;

  dispatch({ type: 'SET_GENERATING', payload: true });

  try {
    let messages;
    switch (key) {
      case 'requirements':
        messages = buildRequirementsPrompt(platform, text, context);
        break;
      case 'asIs':
        messages = buildAsIsPrompt(platform, text, sections.requirements.text, context);
        break;
      case 'toBe':
        messages = buildToBePrompt(platform, text, sections.requirements.text, context);
        break;
      case 'fsd':
        messages = buildFSDPrompt(platform, text, sections.requirements.text, sections.asIs.text, sections.toBe.text, context);
        break;
      case 'tsd':
        messages = buildTSDPrompt(platform, text, sections.fsd.text, context);
        break;
      case 'ricef':
        messages = buildRICEFPrompt(platform, text, sections.requirements.text, sections.fsd.text, sections.tsd.text, context);
        break;
      default:
        throw new Error(`Unknown section key: ${key}`);
    }

    await streamSection({
      key, messages, dispatch, llmConfig, role: 'generator', signal,
      currentMetrics: {
        inputTokens:  state.metrics?.inputTokens  || 0,
        outputTokens: state.metrics?.outputTokens || 0,
      },
    });
    dispatch({ type: 'SET_GENERATING', payload: false });
  } catch (err) {
    if (err?.name === 'AbortError') {
      dispatch({ type: 'SET_GENERATING', payload: false });
      return;
    }
    dispatch({ type: 'SET_GENERATION_ERROR', payload: err.message });
  }
}

// ─── Validator JSON extraction ─────────────────────────────────────────────────
// Validator models frequently skip the requested ```json fence or add stray
// commentary around the object. Try, in order: a fenced block (with or without
// the "json" tag), the outermost {...} span in the text, then the raw text.

function extractValidatorJSON(text) {
  const candidates = [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) candidates.push(fenced[1]);

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  candidates.push(text);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // try next candidate
    }
  }
  return null;
}

// ─── Validation pipeline ──────────────────────────────────────────────────────

export async function runValidation({ state, dispatch, signal }) {
  const { sections, project, llmConfig } = state;
  const platform = project.platform || 'maximo';

  if (!sections.ricef.text) {
    dispatch({ type: 'SET_VALIDATION_ERROR', payload: 'No generated spec to validate. Run generation first.' });
    return;
  }

  dispatch({ type: 'SET_VALIDATING', payload: true });

  try {
    const messages = buildValidationPrompt(
      platform,
      sections.ricef.text,
      sections.fsd.text,
      sections.tsd.text,
    );

    let accumulated = '';
    let valInput = 0;
    let valOutput = 0;
    const generate = getGenerateFunc('validator', llmConfig);

    await generate({
      messages,
      signal,
      maxTokens: 6144, // validation JSON (5 criteria + arrays) is more verbose than a single section
      onToken: (t) => { accumulated += t; },
      onDone: (usage) => {
        valInput  = usage?.inputTokens    || 0;
        valOutput = usage?.generatedTokens || 0;
      },
    });

    // Accumulate validation tokens on top of generation totals
    const prevInput  = state.metrics?.inputTokens  || 0;
    const prevOutput = state.metrics?.outputTokens || 0;
    const newInput   = prevInput  + valInput;
    const newOutput  = prevOutput + valOutput;
    const newTotal   = newInput   + newOutput;
    const { ru, usd } = calcCost(newTotal);
    dispatch({
      type: 'UPDATE_METRICS',
      payload: { inputTokens: newInput, outputTokens: newOutput, totalTokens: newTotal, totalRU: ru, totalCostUSD: usd },
    });

    // Extract JSON from the response
    let result = extractValidatorJSON(accumulated);
    if (!result) {
      // Fallback: create a structured result indicating parse failure
      result = {
        criteria: [
          { name: 'Completeness', status: 'WARN', score: 50, feedback: 'Could not parse validator response — check manually.', blocker: false },
          { name: 'Platform Alignment', status: 'WARN', score: 50, feedback: 'Raw response: ' + accumulated.slice(0, 200), blocker: false },
          { name: 'Consistency', status: 'WARN', score: 50, feedback: '', blocker: false },
          { name: 'Clarity', status: 'WARN', score: 50, feedback: '', blocker: false },
          { name: 'Bob Readiness', status: 'WARN', score: 50, feedback: '', blocker: false },
        ],
        overall: 'FAIL',
        blockers: ['Validator response could not be parsed as JSON'],
        warnings: [],
        missing_topics: [],
      };
    }

    dispatch({ type: 'SET_VALIDATION_RESULT', payload: result });
  } catch (err) {
    if (err?.name === 'AbortError') {
      dispatch({ type: 'SET_VALIDATING', payload: false });
      return;
    }
    dispatch({ type: 'SET_VALIDATION_ERROR', payload: err.message });
  }
}

// ─── Orchestrate integration ──────────────────────────────────────────────────

export async function sendToOrchestrate({ state, dispatch, signal }) {
  const { sections, project, llmConfig } = state;
  const { orchestrate } = llmConfig;

  if (!orchestrate.enabled || !orchestrate.baseUrl || !orchestrate.apiKey) {
    // Fallback to local validator
    return runValidation({ state, dispatch, signal });
  }

  dispatch({ type: 'SET_VALIDATING', payload: true });

  try {
    const body = {
      input: `Please review this spec:\n\n${sections.fsd.text}\n\n${sections.tsd.text}\n\n${sections.ricef.text}`,
    };

    const res = await fetch(`${orchestrate.baseUrl}/v1/chat`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${orchestrate.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('Orchestrate unavailable, falling back to local validator');
      return runValidation({ state, dispatch, signal });
    }

    const data = await res.json();
    const text = data?.output || data?.choices?.[0]?.message?.content || '';

    // Try to parse as structured result
    const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[1]);
        dispatch({ type: 'SET_VALIDATION_RESULT', payload: result });
        return;
      } catch (_) {}
    }

    // If orchestrate returned unstructured feedback, wrap it
    dispatch({
      type: 'SET_VALIDATION_RESULT',
      payload: {
        criteria: [
          { name: 'Orchestrate Review', status: 'PASS', score: 80, feedback: text.slice(0, 500), blocker: false },
        ],
        overall: 'PASS',
        blockers: [],
        warnings: ['Orchestrate returned unstructured response — review manually'],
        missing_topics: [],
      },
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      dispatch({ type: 'SET_VALIDATING', payload: false });
      return;
    }
    // Network error → fallback
    console.warn('Orchestrate error, falling back to local validator:', err.message);
    return runValidation({ state, dispatch, signal });
  }
}
