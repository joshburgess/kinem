import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      "motif-animate": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
})
