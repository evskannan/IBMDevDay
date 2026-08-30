import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SpecBridge — Vite configuration
// The dev-server proxy handles CORS for IBM IAM and watsonx.ai endpoints.
// This is a dev-server convenience route, NOT an application backend.
// The app itself is 100% browser-only; no server code ships with it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // IBM IAM token endpoint — CORS blocked from browsers
      '/ibm-iam': {
        target: 'https://iam.cloud.ibm.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ibm-iam/, ''),
        secure: true,
      },
      // watsonx.ai Dallas ML endpoint
      '/watsonx': {
        target: 'https://us-south.ml.cloud.ibm.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/watsonx/, ''),
        secure: true,
      },
      // OpenAI-compatible proxy fallback (configured per-user in the Settings UI)
      '/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
        secure: true,
      },
    },
  },
});
