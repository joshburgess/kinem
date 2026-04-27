import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@kinem/core": path.resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "packages/core/src/**/*.ts",
        "packages/react/src/**/*.{ts,tsx}",
        "packages/vue/src/**/*.ts",
        "packages/svelte/src/**/*.ts",
        "packages/devtools/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.bench.ts",
        "**/test/**",
        "**/test-setup.ts",
        "**/dist/**",
        "**/index.ts",
        "**/slim.ts",
        "packages/devtools-extension/**",
        "packages/core/src/interpolate/register-defaults.ts",
        "packages/core/src/render/worker-protocol.ts",
      ],
      // Floors set ~5 points below current measurements (lines 90.9 /
      // statements 87.5 / functions 88.7 / branches 74.4) so casual
      // churn doesn't trip CI but a real coverage regression does.
      // Bump these up, never down, when adding tests.
      thresholds: {
        lines: 85,
        statements: 82,
        functions: 85,
        branches: 70,
      },
    },
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
