import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      // The renderer HTML lives under src/renderer, not project root.
      // Without this, `vite build` cannot find index.html.
      input: 'src/renderer/index.html'
    }
  }
});
