import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    // O chunk principal carrega o núcleo do PixiJS (~170 kB gzip). Os renderers
    // WebGL/WebGPU já vêm em chunks separados, sob demanda.
    chunkSizeWarningLimit: 600,
  },
});
