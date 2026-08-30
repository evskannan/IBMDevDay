// SpecBridge — Inputs Tab
// Handles transcript upload (DOCX/TXT/paste), template upload, platform selector, seeded data.

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Code, BookOpen, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SEED_TRANSCRIPT } from '../data/seedTranscript';
import { saveConfig } from '../services/db';
import mammoth from 'mammoth';

const PLATFORMS = [
  { value: 'maximo',      label: 'IBM Maximo Application Suite' },
  { value: 'servicenow',  label: 'ServiceNow' },
  { value: 'sap',         label: 'SAP S/4HANA' },
  { value: 'custom',      label: 'Custom Application' },
];

export function InputsTab() {
  const { state, dispatch } = useApp();
  const { transcript, template, project } = state;
  const [dragOver, setDragOver] = useState(false);
  const [templateDrag, setTemplateDrag] = useState(false);
  const pasteRef = useRef(null);

  // ─── Transcript handlers ────────────────────────────────────────────────────

  const handleTranscriptFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'docx') {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      dispatch({ type: 'SET_TRANSCRIPT', payload: { text: result.value, fileName: file.name, source: 'upload' } });
    } else {
      const text = await file.text();
      dispatch({ type: 'SET_TRANSCRIPT', payload: { text, fileName: file.name, source: 'upload' } });
    }
  }, [dispatch]);

  const onTranscriptDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleTranscriptFile(file);
  }, [handleTranscriptFile]);

  const onTranscriptChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleTranscriptFile(file);
  }, [handleTranscriptFile]);

  const loadSeed = () => {
    dispatch({ type: 'SET_TRANSCRIPT', payload: { text: SEED_TRANSCRIPT, fileName: 'seed-transcript.txt', source: 'seed' } });
  };

  const clearTranscript = () => {
    dispatch({ type: 'SET_TRANSCRIPT', payload: { text: '', fileName: null, source: null } });
  };

  // ─── Template handlers ──────────────────────────────────────────────────────

  const handleTemplateFile = useCallback(async (file) => {
    if (!file) return;
    const buf = await file.arrayBuffer();

    // Extract headings using mammoth for the tree preview
    let headings = [];
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      const lines = result.value.split('\n').filter((l) => l.trim());
      headings = lines.slice(0, 20); // Show first 20 lines as preview
    } catch (_) {}

    dispatch({ type: 'SET_TEMPLATE', payload: { buffer: buf, fileName: file.name, headings } });
  }, [dispatch]);

  const onTemplateDrop = useCallback((e) => {
    e.preventDefault();
    setTemplateDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleTemplateFile(file);
  }, [handleTemplateFile]);

  // ─── Project handlers ───────────────────────────────────────────────────────

  const updateProject = (field, value) => {
    const updated = { ...project, [field]: value };
    dispatch({ type: 'SET_PROJECT', payload: { [field]: value } });
    saveConfig('project', updated);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tab-content">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Project Setup */}
        <div className="card mb-md">
          <div className="card-header">
            <Code size={14} />
            Project Setup
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  className="form-input"
                  value={project.name}
                  onChange={(e) => updateProject('name', e.target.value)}
                  placeholder="e.g. EAGLE Utilities — PM Enhancement"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target Platform</label>
                <select
                  className="form-select"
                  value={project.platform}
                  onChange={(e) => updateProject('platform', e.target.value)}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Project Context (optional)</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={project.context}
                onChange={(e) => updateProject('context', e.target.value)}
                placeholder="Any additional context about the project, module, or business unit..."
              />
              <span className="form-hint">This is appended to every LLM system prompt for additional specificity.</span>
            </div>
          </div>
        </div>

        {/* Transcript Upload */}
        <div className="card mb-md">
          <div className="card-header">
            <FileText size={14} />
            Meeting Transcript
            <div className="card-header-actions">
              <button className="btn btn-sm" onClick={loadSeed} title="Load synthetic EAGLE Utilities demo transcript">
                <BookOpen size={12} /> Load Demo
              </button>
              {transcript.text && (
                <button className="btn btn-sm btn-ghost" onClick={clearTranscript}>
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          </div>
          <div className="card-body">
            {!transcript.text ? (
              <div
                className={`upload-zone${dragOver ? ' dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onTranscriptDrop}
              >
                <input type="file" accept=".docx,.txt,.md" onChange={onTranscriptChange} />
                <div className="upload-zone-icon"><Upload size={28} /></div>
                <div className="upload-zone-title">Drop transcript here</div>
                <div className="upload-zone-hint">DOCX, TXT, or Markdown · Or paste below · Or load demo</div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-sm mb-md">
                  <FileText size={14} color="var(--color-success)" />
                  <span className="text-success font-bold">{transcript.fileName || 'Pasted text'}</span>
                  <span className="tag">{transcript.text.length.toLocaleString()} chars</span>
                  <span className="tag">{transcript.source}</span>
                </div>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 280, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  value={transcript.text}
                  onChange={(e) => dispatch({ type: 'SET_TRANSCRIPT', payload: { text: e.target.value } })}
                  placeholder="Paste your meeting transcript here..."
                />
              </div>
            )}

            {!transcript.text && (
              <div className="mt-md">
                <label className="form-label">Or paste transcript</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 200 }}
                  placeholder="Paste transcript text directly here..."
                  onChange={(e) => {
                    if (e.target.value) {
                      dispatch({ type: 'SET_TRANSCRIPT', payload: { text: e.target.value, fileName: null, source: 'paste' } });
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* DOCX Template Upload */}
        <div className="card">
          <div className="card-header">
            <BookOpen size={14} />
            FSD/TSD DOCX Template (optional)
          </div>
          <div className="card-body">
            {!template.buffer ? (
              <div
                className={`upload-zone${templateDrag ? ' dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setTemplateDrag(true); }}
                onDragLeave={() => setTemplateDrag(false)}
                onDrop={onTemplateDrop}
              >
                <input type="file" accept=".docx" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleTemplateFile(f); }} />
                <div className="upload-zone-icon"><Upload size={24} /></div>
                <div className="upload-zone-title">Drop DOCX template here</div>
                <div className="upload-zone-hint">Template must use {`{{fsd}}`}, {`{{tsd}}`}, {`{{ricef}}`} placeholders</div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-sm mb-md">
                  <FileText size={14} color="var(--color-success)" />
                  <span className="text-success font-bold">{template.fileName}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'SET_TEMPLATE', payload: { buffer: null, fileName: null, headings: [] } })}>
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
                {template.headings.length > 0 && (
                  <div>
                    <div className="form-label mb-md" style={{marginBottom: 6}}>Template preview (first 20 lines):</div>
                    <div className="streaming-text" style={{ maxHeight: 200, overflow: 'auto', background: 'var(--color-bg)', padding: 'var(--spacing-sm)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      {template.headings.join('\n')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
