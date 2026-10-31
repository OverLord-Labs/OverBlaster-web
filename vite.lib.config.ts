import { defineConfig } from "vite";

// The embeddable library: ESM + UMD. Audio and the logo are NOT bundled; the host serves
// public/audio and public/logo.png and passes `assetsUrl` (see docs/EMBEDDING.md).
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/lib",
    target: "es2020",
    emptyOutDir: true,
    lib: { entry: "src/index.ts", name: "OverBlaster", fileName: "overblaster", formats: ["es", "umd"] },
  },
});
