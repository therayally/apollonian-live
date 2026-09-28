import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { port: 6410 },
  build: { outDir: "dist", emptyOutDir: true }
});
