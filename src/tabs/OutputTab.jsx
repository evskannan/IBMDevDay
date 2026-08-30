// SpecBridge — Output & Handoff Tab
// Inline editor, DOCX export, handoff bundle ZIP export.

import React, { useState } from 'react';
import { Download, Package, FileText, Edit3, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportHandoffBundle, exportDocx } from '../services/exportService';

const SECTION_META = [
  { key: 'requirements', label: 'Requirements' },
  { key: 'asIs',         label: 'AS-IS State' },
  { key: 'toBe',         label: 'TO-BE Mapping' },
  { key: 'fsd',          label: 'FSD' },
  { key: 'tsd',          label: 'TSD' },
  { key: 'ricef',        label: 'RICEF-E-001.md' },
];

function EditableSection({ sectionKey, label }) {
  const { state, dispatch } = useApp();
  const [editing, setEditing] = useState(false);
  const section = state.sections[sectionKey];

  const handleChange = (e) => {
    dispatch({
      type: 'UPDATE_SECTION',
      payload: { key: sectionKey, updates: { text: e.target.value } },
    });
  };

  const tracePct =
    section.totalCount > 0
      ? Math.round((section.traceCount / section.totalCount) * 100)
      : null;

  return (
    <div className="spec-section" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div className="spec-section-header">
        <span className="spec-section-title">{label}</span>
        {tracePct !== null && (
          <span className="tag">{tracePct}% traced</span>
        )}
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setEditing(!editing)}
        >
          <Edit3 size={11} /> {editing ? 'Preview' : 'Edit'}
        </button>
      </div>
      <div className="spec-section-body">
        {section.text ? (
          editing ? (
            <textarea
              className="form-textarea"
              style={{ minHeight: 400, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              value={section.text}
              onChange={handleChange}
            />
          ) : (
            <pre className="streaming-text" style={{ maxHeight: 400, overflow: 'auto' }}>
              {section.text}
            </pre>
          )
        ) : (
          <p className="text-subtle text-sm">Not yet generated. Run the Generation tab first.</p>
        )}
      </div>
    </div>
  );
}

export function OutputTab() {
  const { state } = useApp();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const hasAnyContent = Object.values(state.sections).some((s) => s.text);
  const hasRICEF = !!state.sections.ricef.text;

  const handleExportBundle = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportHandoffBundle({ project: state.project, sections: state.sections });
    } catch (err) {
      setError(err.message);
    }
    setExporting(false);
  };

  const handleExportDocx = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportDocx({ templateBuffer: state.template.buffer, sections: state.sections, project: state.project });
    } catch (err) {
      setError(err.message);
    }
    setExporting(false);
  };

  return (
    <div className="tab-content">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Export controls */}
        <div className="card mb-md">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleExportBundle}
              disabled={exporting || !hasAnyContent}
              title="Download the full specbridge-handoff-v1 ZIP"
            >
              <Package size={16} /> {exporting ? 'Exporting...' : 'Export Handoff Bundle (.zip)'}
            </button>

            <button
              className="btn btn-lg"
              onClick={handleExportDocx}
              disabled={exporting || !state.template.buffer || !hasAnyContent}
              title={!state.template.buffer ? 'Upload a DOCX template in Inputs first' : 'Export FSD/TSD as DOCX'}
            >
              <FileText size={16} /> Export as DOCX
            </button>

            {!hasAnyContent && (
              <div className="alert alert-info" style={{ margin: 0 }}>
                <AlertCircle size={13} /> Generate spec sections first.
              </div>
            )}

            {!state.template.buffer && (
              <span className="text-subtle text-xs">Upload a template in Inputs to enable DOCX export.</span>
            )}

            {error && (
              <div className="alert alert-error" style={{ margin: 0, flex: 1 }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Handoff bundle status */}
        {hasRICEF && (
          <div className="alert alert-success mb-md">
            <CheckCircle size={14} />
            RICEF-E-001.md is ready. Export the bundle and hand it to Bob with a deploy brief (API URL + credentials).
          </div>
        )}

        {/* Inline editors */}
        {SECTION_META.map(({ key, label }) => (
          <EditableSection key={key} sectionKey={key} label={label} />
        ))}

      </div>
    </div>
  );
}
