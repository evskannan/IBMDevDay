// SpecBridge — Tab navigation component

import React from 'react';
import { FileText, Cpu, ShieldCheck, Download, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';

const TABS = [
  { id: 'inputs',     label: 'Inputs',      icon: FileText },
  { id: 'generation', label: 'Generation',  icon: Cpu },
  { id: 'validation', label: 'Validation',  icon: ShieldCheck },
  { id: 'output',     label: 'Output',      icon: Download },
  { id: 'settings',   label: 'Settings',    icon: Settings },
];

export function TabNav() {
  const { state, dispatch } = useApp();

  const getBadge = (id) => {
    if (id === 'generation') {
      const done = Object.values(state.sections).filter((s) => s.status === 'done').length;
      if (done > 0) return done;
    }
    if (id === 'validation' && state.validationResult) {
      const fail = state.validationResult.criteria?.filter((c) => c.status === 'FAIL').length || 0;
      if (fail > 0) return fail;
    }
    return null;
  };

  return (
    <nav className="tab-nav">
      {TABS.map(({ id, label, icon: Icon }) => {
        const badge = getBadge(id);
        return (
          <button
            key={id}
            className={`tab-btn${state.activeTab === id ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', payload: id })}
          >
            <Icon size={14} />
            {label}
            {badge !== null && <span className="tab-badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
