import { defineConfig } from 'vite';

export default defineConfig({
  envPrefix: 'VITE_',
  root: '.',
  build: {
    outDir: 'dist',
  },
});
