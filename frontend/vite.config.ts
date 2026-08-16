import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The app is now a client for a real API, so it is served over HTTP rather than
// opened from the file system. `base: './'` is kept so the build still works when
// hosted from a sub-path, but the old double-click-dist/index.html demo flow no
// longer applies — the backend must be running.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
});
