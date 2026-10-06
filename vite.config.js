import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { handle } from './api/_lib/quotes.js';

// Serves the same /api/* routes locally that Vercel serves in production.
const localApi = () => ({
  name: 'stock-chain-local-api',
  configureServer(server) {
    server.middlewares.use('/api', (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      handle(url.pathname, url.searchParams, res);
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api', (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      handle(url.pathname, url.searchParams, res);
    });
  },
});

// `npm run build:single` produces one self-contained HTML file (used for hosted previews).
export default defineConfig(({ mode }) => {
  // Make server-only secrets from .env (e.g. ALPACA_*) available to the local /api routes.
  // They are NOT exposed to the browser: only VITE_* variables are.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;
  return {
  plugins: [react(), localApi(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  };
});
