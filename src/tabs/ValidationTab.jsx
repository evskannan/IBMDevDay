// SpecBridge — Validation Tab
// Runs 5-criterion spec validation via Validator LLM or Orchestrate.

import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Send, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { sendToOrchestrate } from '../services/generationService';

const CRITERION_DESCRIPTIONS = {
  'Completeness': 'All required fields present: launch point, trigger, field details, error handling.',
  'Platform Alignment': 'Objects, events, and field names are correct for the target platform.',
  'Consistency': 'FSD, TSD, and RICEF agree with each other and the requirements.',
  'Clarity': 'Developer can implement with zero clarifying questions.',
  'Bob Readiness': 'RICEF-E-001.md is independently buildable with deploy target section.',
};

function CriterionRow({ criterion }) {
  const statusClass =
    criterion.status === 'PASS' ? 'pass' :
    criterion.status === 'WARN' ? 'warn' : 'fail';

  const Icon =
    criterion.status === 'PASS' ? CheckCircle :
    criterion.status === 'WARN' ? AlertTriangle : XCircle;

  return (
    <div className="criterion-row">
      <div className="criterion-name">
        <Icon size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        {criterion.name}
      </div>
      <div className={`criterion-score ${statusClass}`}>{criterion.score}</div>
      <div className="criterion-feedback">
        <div>{criterion.feedback}</div>
        {criterion.blocker && (
          <span className="tag" style={{ marginTop: 4, borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
            BLOCKER
          </span>
        )}
        {CRITERION_DESCRIPTIONS[criterion.name] && (
          <div className="text-xs text-subtle mt-sm">{CRITERION_DESCRIPTIONS[criterion.name]}</div>
        )}
      </div>
    </div>
  );
}

export function ValidationTab() {
  const { state, dispatch } = useApp();
  const { validationResult, validating, validationError, sections, llmConfig } = state;

  const hasSpec = !!(sections.ricef.text || sections.fsd.text);
  const hasOrchestrate = llmConfig.orchestrate.enabled && llmConfig.orchestrate.baseUrl;

  const handleValidate = async () => {
    const abort = new AbortController();
    await sendToOrchestrate({ state, dispatch, signal: abort.signal });
  };

  const overallPass = validationResult?.overall === 'PASS';

  return (
    <div className="tab-content">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Controls */}
        <div className="card mb-md">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleValidate}
              disabled={validating || !hasSpec}
              title={!hasSpec ? 'Run generation first' : 'Validate spec quality'}
            >
              {validating ? <div className="spinner" /> : <Send size={16} />}
              {hasOrchestrate ? 'Send for Review (Orchestrate)' : 'Validate Spec'}
            </button>

            {!hasSpec && (
              <div className="alert alert-warning" style={{ margin: 0 }}>
                <AlertCircle size={13} /> Generate spec sections first.
              </div>
            )}

            {validationError && (
              <div className="alert alert-error" style={{ margin: 0, flex: 1 }}>
                <AlertCircle size={13} /> {validationError}
              </div>
            )}

            {hasOrchestrate && (
              <span className="tag" style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}>
                Orchestrate Agent Active
              </span>
            )}
          </div>
        </div>

        {/* Results */}
        {validationResult && (
          <>
            {/* Overall */}
            <div className={`alert ${overallPass ? 'alert-success' : 'alert-error'} mb-md`}>
              {overallPass ? <CheckCircle size={14} /> : <XCircle size={14} />}
              <strong>Overall: {validationResult.overall}</strong>
              {validationResult.blockers?.length > 0 && (
                <span> — {validationResult.blockers.length} blocker(s)</span>
              )}
            </div>

            {/* Criteria */}
            <div className="card mb-md">
              <div className="card-header"><ShieldCheck size={14} /> Validation Criteria</div>
              <div className="card-body">
                {validationResult.criteria?.map((c) => (
                  <CriterionRow key={c.name} criterion={c} />
                ))}
              </div>
            </div>

            {/* Blockers */}
            {validationResult.blockers?.length > 0 && (
              <div className="card mb-md">
                <div className="card-header" style={{ color: 'var(--color-error)' }}>
                  <XCircle size={14} /> Blockers (must fix before Bob deploy)
                </div>
                <div className="card-body">
                  <ul style={{ paddingLeft: 20 }}>
                    {validationResult.blockers.map((b, i) => (
                      <li key={i} className="text-error text-sm" style={{ marginBottom: 4 }}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings?.length > 0 && (
              <div className="card mb-md">
                <div className="card-header" style={{ color: 'var(--color-warning)' }}>
                  <AlertTriangle size={14} /> Warnings
                </div>
                <div className="card-body">
                  <ul style={{ paddingLeft: 20 }}>
                    {validationResult.warnings.map((w, i) => (
                      <li key={i} className="text-warning text-sm" style={{ marginBottom: 4 }}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Missing topics */}
            {validationResult.missing_topics?.length > 0 && (
              <div className="card">
                <div className="card-header"><AlertCircle size={14} /> Missing Topics</div>
                <div className="card-body">
                  <ul style={{ paddingLeft: 20 }}>
                    {validationResult.missing_topics.map((t, i) => (
                      <li key={i} className="text-muted text-sm" style={{ marginBottom: 4 }}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {!validationResult && !validating && (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <ShieldCheck size={40} color="var(--color-text-subtle)" style={{ marginBottom: 12 }} />
              <p className="text-muted">Run validation to review spec quality across 5 criteria.</p>
              <p className="text-subtle text-sm mt-sm">
                Criteria: Completeness · Platform Alignment · Consistency · Clarity · Bob Readiness
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
