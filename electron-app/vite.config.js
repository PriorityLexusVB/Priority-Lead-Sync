import { defineConfig } from "vite";
export default defineConfig({
  root: ".",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
    rollupOptions: { input: "src/renderer/index.html" },
  },
  server: { port: 5173 },
});
