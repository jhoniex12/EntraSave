import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Vite dev server. The `/api` proxy forwards to the Express API so that in
 * development the SPA and API are same-origin from the browser's perspective —
 * the `entrasave_session` HttpOnly cookie is then a normal same-site cookie and
 * no CORS preflight is needed. In production the two are served same-site behind
 * IIS/Cloudflare (see docs/ARCHITECTURE.md §0a, §2).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
});
