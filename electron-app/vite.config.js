import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: '.',                  // renderer lives at project root now
  server: { port: 5173 },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'), // entry is the root index.html
    },
  },
});

