import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "motif-animate": path.resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          include: ["packages/core/src/**/*.test.ts", "packages/core/test/**/*.test.ts"],
          environment: "node",
          setupFiles: ["packages/core/test-setup.ts"],
          benchmark: { include: ["benchmarks/src/**/*.bench.ts"] },
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          include: ["packages/react/src/**/*.test.{ts,tsx}"],
          environment: "happy-dom",
          setupFiles: ["packages/react/test-setup.ts", "packages/core/test-setup.ts"],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: "vue",
          include: ["packages/vue/src/**/*.test.ts"],
          environment: "happy-dom",
          setupFiles: ["packages/core/test-setup.ts"],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: "svelte",
          include: ["packages/svelte/src/**/*.test.ts"],
          environment: "happy-dom",
          setupFiles: ["packages/core/test-setup.ts"],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: "devtools",
          include: ["packages/devtools/src/**/*.test.ts"],
          environment: "happy-dom",
          setupFiles: ["packages/core/test-setup.ts"],
          benchmark: { include: [] },
        },
      },
    ],
  },
})
