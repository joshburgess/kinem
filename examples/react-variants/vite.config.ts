import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@kinem/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@kinem/react": path.resolve(__dirname, "../../packages/react/src/index.ts"),
    },
  },
})
