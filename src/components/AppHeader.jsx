// SpecBridge — Header component
// Shows logo, metrics bar: tokens, RU, cost (USD), traceability %.

import React from 'react';
import { Zap, Activity, CheckCircle, DollarSign } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Format cost: show cents when < $0.01, otherwise dollars
function formatCost(usd) {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `${(usd * 100).toFixed(4)}¢`;
  return `$${usd.toFixed(4)}`;
}

export function AppHeader() {
  const { state } = useApp();
  const { metrics } = state;

  const tracePct   = metrics.traceabilityPct || 0;
  const traceClass = tracePct >= 90 ? 'good' : 'warn';
  const costUSD    = metrics.totalCostUSD || 0;
  // Colour the cost indicator: green < $0.01, yellow < $0.05, red >= $0.05
  const costColor  = costUSD >= 0.05
    ? 'var(--color-error)'
    : costUSD >= 0.01
      ? 'var(--color-warning)'
      : 'var(--color-success)';

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
          <span className="metric-value">{(metrics.totalTokens || 0).toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="metric-label">RU:</span>
          <span className="metric-value">{(metrics.totalRU || 0).toFixed(3)}</span>
        </div>
        {/* Cost display — IBM: 1,000 tokens = 1 RU = $0.0001 */}
        <div className="metric" title="IBM watsonx cost: 1,000 tokens = 1 RU = $0.0001 USD">
          <DollarSign size={11} color={costColor} />
          <span className="metric-value" style={{ color: costColor }}>
            {formatCost(costUSD)}
          </span>
          <span className="metric-label">USD</span>
        </div>
        <div className="metrics-divider" />
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
