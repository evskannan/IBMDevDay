// SpecBridge — Header component
// Shows logo, tab navigation, and live metrics bar.

import React from 'react';
import { Zap, Activity, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function AppHeader() {
  const { state } = useApp();
  const { metrics } = state;

  const tracePct = metrics.traceabilityPct || 0;
  const traceClass = tracePct >= 90 ? 'good' : 'warn';

  return (
    <header className="app-header">
      <div className="app-header-logo">
        <Zap size={18} color="var(--color-accent-hover)" />
        <span>Spec<span className="accent">Bridge</span></span>
      </div>

      <div className="header-spacer" />

      <div className="metrics-bar">
        <div className="metric">
          <span className="metric-label">Tokens:</span>
          <span className="metric-value">{metrics.totalTokens.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="metric-label">RU:</span>
          <span className="metric-value">{metrics.totalRU.toFixed(3)}</span>
        </div>
        <div className={`traceability-badge ${traceClass}`}>
          <CheckCircle size={11} />
          <span>Trace: {tracePct}%</span>
        </div>
        <div className="metric">
          <Activity size={12} />
          <span className="metric-label text-subtle">SpecBridge v1</span>
        </div>
      </div>
    </header>
  );
}
