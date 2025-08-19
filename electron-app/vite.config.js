// electron-app/vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // index.html at project root
  server: { port: 5173 },
  envPrefix: ['VITE_', 'APP_FIREBASE_'],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: { input: 'index.html' }
  }
});
