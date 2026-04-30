import path from "node:path"
import { defineConfig } from "vite"

// Set SHOWCASE_BASE when building for embedding in another site
// (e.g. the GH Pages docs), where the showcase lives at a sub-path.
// Defaults to "/" for local dev and standalone deploys.
export default defineConfig({
  base: process.env.SHOWCASE_BASE ?? "/",
  resolve: {
    alias: {
      "@kinem/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
})
