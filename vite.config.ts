import { defineConfig } from "vite";

// The demo site: index.html + the game. public/ (audio, logo) is copied as-is.
export default defineConfig({
  base: "./",
  build: { outDir: "dist/site", target: "es2020" },
});
