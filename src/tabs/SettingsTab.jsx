// SpecBridge — Settings Tab
// LLM provider configuration for Generator and Validator roles.
// API keys stored in localStorage, clearable from UI. No keys committed to code.

import React, { useState } from 'react';
import { Settings, Eye, EyeOff, Wifi, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { testWatsonxConnection, listWatsonxModels } from '../services/watsonxProvider';
import { testOpenAIConnection, listOpenAIModels } from '../services/openaiProvider';
import { saveConfig, clearConfig } from '../services/db';

const BANNED_MODELS = [
  'llama-3-405b-instruct',
  'mistral-medium-2505',
  'mistral-small-3-1-24b-instruct-2503',
];

const GRANITE_MODELS = [
  'ibm/granite-13b-chat-v2',
  'ibm/granite-20b-multilingual',
  'ibm/granite-34b-code-instruct',
  'ibm/granite-3-2b-instruct',
  'ibm/granite-3-8b-instruct',
];

function ProviderConfig({ role }) {
  const { state, dispatch } = useApp();
  const cfg = state.llmConfig[role];

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const update = (path, value) => {
    const parts = path.split('.');
    let update = {};
    let cur = update;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    dispatch({ type: 'SET_LLM_CONFIG', payload: { [role]: update } });
    // Persist (strip API keys from localStorage? No — they're already only in localStorage)
    saveConfig('llmConfig', state.llmConfig);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let result;
      if (cfg.provider === 'watsonx') {
        result = await testWatsonxConnection(cfg.watsonx);
      } else {
        result = await testOpenAIConnection(cfg.openai);
      }
      setTestResult({ ok: true, msg: `Connected — ${result.modelCount} models available` });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    }
    setTesting(false);
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      let models;
      if (cfg.provider === 'watsonx') {
        models = await listWatsonxModels(cfg.watsonx);
      } else {
        models = await listOpenAIModels(cfg.openai);
      }
      setAvailableModels(models.filter((m) => !BANNED_MODELS.includes(m)));
    } catch (err) {
      setTestResult({ ok: false, msg: `Model fetch failed: ${err.message}` });
    }
    setFetchingModels(false);
  };

  const handleClearKeys = () => {
    if (cfg.provider === 'watsonx') {
      update('watsonx.apiKey', '');
    } else {
      update('openai.apiKey', '');
    }
    setTestResult(null);
  };

  return (
    <div className="card mb-md">
      <div className="card-header">
        <Settings size={14} />
        {role === 'generator' ? 'Generator LLM' : 'Validator LLM'}
        <div className="card-header-actions">
          <button className="btn btn-sm btn-ghost" onClick={handleClearKeys} title="Clear API key from localStorage">
            <Trash2 size={11} /> Clear Key
          </button>
        </div>
      </div>
      <div className="card-body">

        {/* Provider selector */}
        <div className="form-group">
          <label className="form-label">Provider</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['watsonx', 'openai'].map((p) => (
              <button
                key={p}
                className={`btn${cfg.provider === p ? ' btn-primary' : ''}`}
                onClick={() => update('provider', p)}
              >
                {p === 'watsonx' ? 'IBM watsonx.ai' : 'OpenAI-compatible'}
              </button>
            ))}
          </div>
        </div>

        {cfg.provider === 'watsonx' ? (
          <>
            <div className="form-group">
              <label className="form-label">watsonx.ai Endpoint URL</label>
              <input
                className="form-input"
                value={cfg.watsonx.endpointUrl}
                onChange={(e) => update('watsonx.endpointUrl', e.target.value)}
                placeholder="https://us-south.ml.cloud.ibm.com"
              />
              <span className="form-hint">Dallas region endpoint. Dev-server proxy maps /watsonx → this host.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Project ID</label>
              <input
                className="form-input"
                value={cfg.watsonx.projectId}
                onChange={(e) => update('watsonx.projectId', e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showKey ? 'text' : 'password'}
                  value={cfg.watsonx.apiKey}
                  onChange={(e) => update('watsonx.apiKey', e.target.value)}
                  placeholder="Stored in localStorage only — never committed"
                />
                <button
                  className="btn btn-ghost btn-icon"
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <span className="form-hint">Key is stored in localStorage only. Use "Clear Key" to remove it.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select
                className="form-select"
                value={cfg.watsonx.modelId}
                onChange={(e) => update('watsonx.modelId', e.target.value)}
              >
                {(availableModels.length > 0 ? availableModels : GRANITE_MODELS).map((m) => (
                  <option key={m} value={m} disabled={BANNED_MODELS.includes(m)}>
                    {m}{BANNED_MODELS.includes(m) ? ' (BANNED — hackathon rule)' : ''}
                  </option>
                ))}
              </select>
              <button className="btn btn-sm mt-sm" onClick={handleFetchModels} disabled={fetchingModels}>
                {fetchingModels ? 'Fetching...' : 'Fetch models from endpoint'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Base URL</label>
              <input
                className="form-input"
                value={cfg.openai.baseUrl}
                onChange={(e) => update('openai.baseUrl', e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showKey ? 'text' : 'password'}
                  value={cfg.openai.apiKey}
                  onChange={(e) => update('openai.apiKey', e.target.value)}
                  placeholder="sk-... or your provider key"
                />
                <button
                  className="btn btn-ghost btn-icon"
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={cfg.openai.modelId}
                  onChange={(e) => update('openai.modelId', e.target.value)}
                  placeholder="gpt-4o-mini"
                />
                <button className="btn btn-sm" onClick={handleFetchModels} disabled={fetchingModels} style={{ whiteSpace: 'nowrap' }}>
                  {fetchingModels ? '...' : 'Fetch'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Test button */}
        <div className="flex items-center gap-sm">
          <button className="btn" onClick={handleTest} disabled={testing}>
            <Wifi size={13} /> {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`} style={{ margin: 0 }}>
              {testResult.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
              {testResult.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrchestrateConfig() {
  const { state, dispatch } = useApp();
  const cfg = state.llmConfig.orchestrate;
  const [showKey, setShowKey] = useState(false);

  const update = (field, value) => {
    dispatch({ type: 'SET_LLM_CONFIG', payload: { orchestrate: { ...cfg, [field]: value } } });
    saveConfig('llmConfig', state.llmConfig);
  };

  return (
    <div className="card">
      <div className="card-header">
        <Settings size={14} />
        watsonx Orchestrate (optional)
      </div>
      <div className="card-body">
        <div className="alert alert-info mb-md">
          <AlertCircle size={13} />
          If configured, "Send for Review" will POST to the Orchestrate Spec Review & Handoff Agent.
          If unreachable, SpecBridge automatically falls back to the local Validator LLM.
        </div>

        <div className="form-group">
          <label className="form-label">Enable Orchestrate</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            <span>Use Orchestrate Spec Review & Handoff Agent</span>
          </label>
        </div>

        {cfg.enabled && (
          <>
            <div className="form-group">
              <label className="form-label">Orchestrate Base URL</label>
              <input
                className="form-input"
                value={cfg.baseUrl}
                onChange={(e) => update('baseUrl', e.target.value)}
                placeholder="https://api.ibm.com/watsonx/orchestrate/v1"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Agent ID</label>
              <input
                className="form-input"
                value={cfg.agentId}
                onChange={(e) => update('agentId', e.target.value)}
                placeholder="spec-review-handoff-agent"
              />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showKey ? 'text' : 'password'}
                  value={cfg.apiKey}
                  onChange={(e) => update('apiKey', e.target.value)}
                  placeholder="Orchestrate API key"
                />
                <button
                  className="btn btn-ghost btn-icon"
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsTab() {
  const { state, dispatch } = useApp();
  const metrics = state.metrics;

  const handleClearAll = () => {
    if (confirm('Clear all stored API keys and settings?')) {
      ['llmConfig', 'project'].forEach((k) => clearConfig(k));
      window.location.reload();
    }
  };

  const uptime = metrics.sessionStart
    ? Math.floor((Date.now() - metrics.sessionStart) / 60000)
    : 0;

  return (
    <div className="tab-content">
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Security notice */}
        <div className="alert alert-warning mb-md">
          <AlertCircle size={14} />
          <div>
            <strong>Security:</strong> API keys are stored in <code>localStorage</code> only —
            never in source code, never committed. Use "Clear Key" per provider or "Clear All" below.
            The Vite dev-server proxy handles CORS; no keys are sent through any backend.
          </div>
        </div>

        <ProviderConfig role="generator" />
        <ProviderConfig role="validator" />
        <OrchestrateConfig />

        {/* Metrics */}
        <div className="card mt-md">
          <div className="card-header">Session Metrics</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div>
                <div className="form-label">Total Tokens</div>
                <div className="text-accent font-bold" style={{ fontSize: 20 }}>{metrics.totalTokens.toLocaleString()}</div>
              </div>
              <div>
                <div className="form-label">Resource Units (RU)</div>
                <div className="text-accent font-bold" style={{ fontSize: 20 }}>{metrics.totalRU.toFixed(3)}</div>
                <div className="text-subtle text-xs">1,000 tokens = 1 RU = $0.0001</div>
              </div>
              <div>
                <div className="form-label">Traceability</div>
                <div className="text-accent font-bold" style={{ fontSize: 20 }}>{metrics.traceabilityPct}%</div>
                <div className="text-subtle text-xs">Target: 100%</div>
              </div>
            </div>
            <div className="divider" />
            <div className="text-subtle text-xs">Session uptime: {uptime} minutes</div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card mt-md" style={{ borderColor: 'var(--color-error)' }}>
          <div className="card-header" style={{ color: 'var(--color-error)' }}>Danger Zone</div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-sm text-muted">Clear all stored settings and API keys from localStorage.</span>
            <button className="btn btn-danger" onClick={handleClearAll}>Clear All &amp; Reset</button>
          </div>
        </div>

      </div>
    </div>
  );
}
