// SpecBridge — Generation Tab
// Runs the full pipeline: Transcript → Requirements → AS-IS → TO-BE → FSD → TSD → RICEF
// Each section streams live; sections can be regenerated individually.

import React, { useRef, useState } from 'react';
import { Play, Square, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { runGeneration, regenerateSection } from '../services/generationService';

const SECTION_META = [
  { key: 'requirements', label: 'Requirements',           emoji: '📋' },
  { key: 'asIs',         label: 'AS-IS State',            emoji: '🔍' },
  { key: 'toBe',         label: 'TO-BE Mapping',          emoji: '🗺️' },
  { key: 'fsd',          label: 'Functional Spec (FSD)',  emoji: '📄' },
  { key: 'tsd',          label: 'Technical Spec (TSD)',   emoji: '⚙️' },
  { key: 'ricef',        label: 'RICEF-E-001.md',         emoji: '🤖' },
];

const STATUS_COLOR = {
  idle:      'grey',
  streaming: 'blue',
  done:      'green',
  error:     'red',
};

function SectionBlock({ sectionKey, label, emoji }) {
  const { state, dispatch } = useApp();
  const [expanded, setExpanded] = useState(true);
  const abortRef = useRef(null);

  const section = state.sections[sectionKey];
  const statusColor = STATUS_COLOR[section.status] || 'grey';

  const handleRegenerate = async () => {
    abortRef.current = new AbortController();
    await regenerateSection({
      key: sectionKey,
      state,
      dispatch,
      signal: abortRef.current.signal,
    });
  };

  const tracePct =
    section.totalCount > 0
      ? Math.round((section.traceCount / section.totalCount) * 100)
      : 0;

  return (
    <div className="spec-section">
      <div className="spec-section-header" onClick={() => setExpanded(!expanded)}>
        <span className="status-dot" style={{
          backgroundColor: `var(--color-${statusColor === 'grey' ? 'text-subtle' : statusColor === 'blue' ? 'accent' : statusColor === 'green' ? 'success' : 'error'})`
        }} />
        <span className="spec-section-title">{emoji} {label}</span>

        {section.status === 'streaming' && <div className="spinner" />}
        {section.status === 'done' && (
          <span className="tag" style={{ marginRight: 4 }}>
            Trace {tracePct}%
          </span>
        )}
        {section.status !== 'streaming' && section.text && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}
            title="Regenerate this section"
          >
            <RefreshCw size={11} /> Regen
          </button>
        )}
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {expanded && (
        <div className="spec-section-body">
          {section.text ? (
            <pre className={`streaming-text${section.status === 'streaming' ? ' streaming-cursor' : ''}`}>
              {section.text}
            </pre>
          ) : (
            <p className="text-subtle text-sm">
              {section.status === 'idle' ? 'Waiting for generation...' : 'Generating...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function GenerationTab() {
  const { state, dispatch } = useApp();
  const abortRef = useRef(null);

  const hasTranscript = !!state.transcript.text;
  const hasLLMConfig = !!(
    state.llmConfig.generator.provider === 'watsonx'
      ? state.llmConfig.generator.watsonx.apiKey
      : state.llmConfig.generator.openai.apiKey
  );

  const handleGenerate = async () => {
    abortRef.current = new AbortController();
    await runGeneration({ state, dispatch, signal: abortRef.current.signal });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    dispatch({ type: 'SET_GENERATING', payload: false });
  };

  return (
    <div className="tab-content">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Controls */}
        <div className="card mb-md">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            {state.generating ? (
              <button className="btn btn-danger" onClick={handleStop}>
                <Square size={14} /> Stop Generation
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleGenerate}
                disabled={!hasTranscript}
                title={!hasTranscript ? 'Load a transcript in the Inputs tab first' : 'Generate all spec sections'}
              >
                <Play size={16} /> Generate All Sections
              </button>
            )}

            {!hasTranscript && (
              <div className="alert alert-warning" style={{ margin: 0, padding: '6px 10px' }}>
                <AlertCircle size={13} /> No transcript loaded — go to Inputs tab first.
              </div>
            )}

            {!hasLLMConfig && (
              <div className="alert alert-info" style={{ margin: 0, padding: '6px 10px' }}>
                <AlertCircle size={13} /> Configure LLM provider in Settings first.
              </div>
            )}

            {state.generationError && (
              <div className="alert alert-error" style={{ margin: 0, flex: 1 }}>
                <AlertCircle size={13} /> {state.generationError}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline: platform label */}
        <div className="flex items-center gap-sm mb-md">
          <span className="text-muted text-sm">Pipeline:</span>
          <span className="tag">Platform: {state.project.platform}</span>
          <span className="tag">Project: {state.project.name}</span>
        </div>

        {/* Section blocks */}
        {SECTION_META.map(({ key, label, emoji }) => (
          <SectionBlock key={key} sectionKey={key} label={label} emoji={emoji} />
        ))}

      </div>
    </div>
  );
}
