import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  root,
  plugins: [react()],
  publicDir: resolve(root, 'public'),
  resolve: {
    // "@/services/api" instead of "../../../services/api".
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // `npm run dev` talks to the backend running in Docker.
    proxy: { '/api': 'http://localhost:3000', '/uploads': 'http://localhost:3000' },
  },
});
