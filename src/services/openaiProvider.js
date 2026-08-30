// SpecBridge — OpenAI-compatible LLM provider adapter
// Works with OpenAI, NVIDIA NIM, OpenRouter, or any compatible gateway.
// Streams SSE from POST {baseUrl}/chat/completions

import { readSSEStream } from './watsonxProvider';

const BANNED_MODELS = [
  'llama-3-405b-instruct',
  'mistral-medium-2505',
  'mistral-small-3-1-24b-instruct-2503',
];

export async function openaiGenerate({ config, messages, onToken, onDone, signal }) {
  if (BANNED_MODELS.includes(config.modelId)) {
    throw new Error(`Model ${config.modelId} is banned by the hackathon rules.`);
  }

  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelId,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI generate failed (${res.status}): ${text}`);
  }

  await readSSEStream(res.body, onToken, onDone);
}

export async function listOpenAIModels(config) {
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!res.ok) throw new Error(`Model list failed (${res.status})`);
  const data = await res.json();
  return (data.data || [])
    .map((m) => m.id)
    .filter((id) => !BANNED_MODELS.includes(id))
    .sort();
}

export async function testOpenAIConnection(config) {
  const models = await listOpenAIModels(config);
  return { ok: true, modelCount: models.length };
}
