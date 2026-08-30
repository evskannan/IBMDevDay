// SpecBridge — App state: Context + useReducer
// Single source of truth for all app state.

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { dbPut, dbGet, loadConfig } from '../services/db';

// ─── Initial State ────────────────────────────────────────────────────────────

export const initialState = {
  // Active tab
  activeTab: 'inputs',

  // Project
  project: {
    id: 'default',
    name: 'Untitled Project',
    platform: 'maximo',         // maximo | servicenow | sap | custom
    module: '',
    context: '',
    createdAt: null,
  },

  // Inputs
  transcript: {
    text: '',
    fileName: null,
    source: null,               // 'upload' | 'paste' | 'seed'
  },
  template: {
    buffer: null,               // ArrayBuffer of DOCX
    fileName: null,
    headings: [],
  },

  // Generation
  generating: false,
  generationError: null,
  sections: {
    requirements: { text: '', status: 'idle', traceCount: 0, totalCount: 0 },
    asIs:         { text: '', status: 'idle', traceCount: 0, totalCount: 0 },
    toBe:         { text: '', status: 'idle', traceCount: 0, totalCount: 0 },
    fsd:          { text: '', status: 'idle', traceCount: 0, totalCount: 0 },
    tsd:          { text: '', status: 'idle', traceCount: 0, totalCount: 0 },
    ricef:        { text: '', status: 'idle', traceCount: 0, totalCount: 0 },
  },

  // Validation
  validating: false,
  validationError: null,
  validationResult: null,   // { criteria: [...], overall: 'pass'|'fail', blockers: [], warnings: [] }

  // LLM config
  llmConfig: {
    generator: {
      provider: 'watsonx',       // 'watsonx' | 'openai'
      watsonx: {
        projectId: '',
        apiKey: '',
        endpointUrl: 'https://us-south.ml.cloud.ibm.com',
        modelId: 'ibm/granite-13b-chat-v2',
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelId: 'gpt-4o-mini',
      },
    },
    validator: {
      provider: 'watsonx',
      watsonx: {
        projectId: '',
        apiKey: '',
        endpointUrl: 'https://us-south.ml.cloud.ibm.com',
        modelId: 'ibm/granite-13b-chat-v2',
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelId: 'gpt-4o-mini',
      },
    },
    orchestrate: {
      enabled: false,
      baseUrl: '',
      apiKey: '',
      agentId: '',
    },
  },

  // Metrics
  metrics: {
    totalTokens: 0,
    totalRU: 0,
    sessionStart: null,
    traceabilityPct: 0,
    clarificationQuestions: 0,
  },
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_PROJECT':
      return { ...state, project: { ...state.project, ...action.payload } };

    case 'SET_TRANSCRIPT':
      return { ...state, transcript: { ...state.transcript, ...action.payload } };

    case 'SET_TEMPLATE':
      return { ...state, template: { ...state.template, ...action.payload } };

    case 'SET_GENERATING':
      return { ...state, generating: action.payload, generationError: null };

    case 'SET_GENERATION_ERROR':
      return { ...state, generating: false, generationError: action.payload };

    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: {
          ...state.sections,
          [action.payload.key]: {
            ...state.sections[action.payload.key],
            ...action.payload.updates,
          },
        },
      };

    case 'RESET_SECTIONS':
      return {
        ...state,
        sections: { ...initialState.sections },
        validationResult: null,
      };

    case 'SET_VALIDATING':
      return { ...state, validating: action.payload, validationError: null };

    case 'SET_VALIDATION_ERROR':
      return { ...state, validating: false, validationError: action.payload };

    case 'SET_VALIDATION_RESULT':
      return { ...state, validating: false, validationResult: action.payload };

    case 'SET_LLM_CONFIG':
      return {
        ...state,
        llmConfig: mergeDeep(state.llmConfig, action.payload),
      };

    case 'UPDATE_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, ...action.payload },
      };

    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// ─── Deep merge helper ────────────────────────────────────────────────────────

function mergeDeep(target, source) {
  const out = { ...target };
  for (const key in source) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = mergeDeep(target[key] ?? {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load persisted state on mount
  useEffect(() => {
    const savedConfig = loadConfig('llmConfig');
    const savedProject = loadConfig('project');
    if (savedConfig || savedProject) {
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          ...(savedConfig ? { llmConfig: mergeDeep(initialState.llmConfig, savedConfig) } : {}),
          ...(savedProject ? { project: { ...initialState.project, ...savedProject } } : {}),
          metrics: { ...initialState.metrics, sessionStart: Date.now() },
        },
      });
    } else {
      dispatch({ type: 'UPDATE_METRICS', payload: { sessionStart: Date.now() } });
    }
  }, []);

  // Compute traceability % whenever sections change
  useEffect(() => {
    const sectionValues = Object.values(state.sections);
    const total = sectionValues.reduce((s, sec) => s + sec.totalCount, 0);
    const traced = sectionValues.reduce((s, sec) => s + sec.traceCount, 0);
    const pct = total > 0 ? Math.round((traced / total) * 100) : 0;
    if (pct !== state.metrics.traceabilityPct) {
      dispatch({ type: 'UPDATE_METRICS', payload: { traceabilityPct: pct } });
    }
  }, [state.sections]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
