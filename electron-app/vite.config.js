// electron-app/vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // index.html is in electron-app/
  server: { port: 5173 },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: { input: 'index.html' }
  }
});
