// SpecBridge — watsonx.ai LLM provider adapter
// Two-step IAM auth: exchange API key -> bearer token, then call the model.
// Token is cached and auto-refreshed at 80% of expires_in.

const BANNED_MODELS = [
  'llama-3-405b-instruct',
  'mistral-medium-2505',
  'mistral-small-3-1-24b-instruct-2503',
];

// ─── IAM Token Cache ──────────────────────────────────────────────────────────

const tokenCache = new Map(); // apiKey -> { token, expiresAt, refreshTimer }

async function getIAMToken(apiKey) {
  const cached = tokenCache.get(apiKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  // Proxy path: /ibm-iam/identity/token -> https://iam.cloud.ibm.com/identity/token
  const res = await fetch('/ibm-iam/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=${encodeURIComponent(apiKey)}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IAM token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const expiresIn = data.expires_in || 3600;
  const expiresAt = Date.now() + expiresIn * 1000 * 0.8; // refresh at 80%

  // Clear previous timer if any
  if (cached?.refreshTimer) clearTimeout(cached.refreshTimer);

  // Schedule proactive refresh
  const refreshTimer = setTimeout(() => {
    tokenCache.delete(apiKey);
  }, expiresIn * 1000 * 0.8);

  tokenCache.set(apiKey, {
    token: data.access_token,
    expiresAt,
    refreshTimer,
  });

  return data.access_token;
}

// ─── Model list ───────────────────────────────────────────────────────────────

export async function listWatsonxModels(config) {
  const token = await getIAMToken(config.apiKey);
  // Use proxy path
  const url = `/watsonx/ml/v1/foundation_model_specs?version=2024-09-16&project_id=${encodeURIComponent(config.projectId)}&limit=200`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Model list failed (${res.status})`);
  const data = await res.json();

  return (data.resources || [])
    .map((m) => m.model_id)
    .filter((id) => !BANNED_MODELS.includes(id))
    .sort();
}

// ─── Generate (streaming) ─────────────────────────────────────────────────────

/**
 * Calls watsonx.ai text-generation with SSE streaming.
 * onToken(text) — called for each token chunk
 * onDone(usage) — called when stream ends; usage = { input_tokens, generated_tokens }
 */
export async function watsonxGenerate({ config, messages, onToken, onDone, signal, maxTokens }) {
  if (BANNED_MODELS.includes(config.modelId)) {
    throw new Error(`Model ${config.modelId} is banned by the hackathon rules.`);
  }

  const token = await getIAMToken(config.apiKey);

  // Proxy path: /watsonx/ml/v1/text/chat_stream -> us-south.ml.cloud.ibm.com/ml/v1/text/chat_stream
  const url = `/watsonx/ml/v1/text/chat_stream?version=2024-09-16`;

  const body = {
    model_id: config.modelId,
    project_id: config.projectId,
    messages,
    parameters: {
      max_new_tokens: maxTokens || 4096,
      temperature: 0.3,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`watsonx generate failed (${res.status}): ${text}`);
  }

  await readSSEStream(res.body, onToken, onDone);
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testWatsonxConnection(config) {
  // Just retrieve the IAM token and call the model list
  await getIAMToken(config.apiKey);
  const models = await listWatsonxModels(config);
  return { ok: true, modelCount: models.length };
}

// ─── SSE stream reader (shared) ───────────────────────────────────────────────

export async function readSSEStream(body, onToken, onDone) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let generatedTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        onDone?.({ inputTokens, generatedTokens });
        return;
      }
      try {
        const json = JSON.parse(payload);
        // watsonx format
        const choice = json.choices?.[0];
        if (choice?.delta?.content) {
          onToken(choice.delta.content);
        }
        if (json.usage) {
          inputTokens = json.usage.prompt_tokens ?? inputTokens;
          generatedTokens = json.usage.completion_tokens ?? generatedTokens;
        }
      } catch (_) {
        // malformed chunk, skip
      }
    }
  }
  onDone?.({ inputTokens, generatedTokens });
}
