import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright smoke tests run against the built examples/playground app.
 * Their job is narrow: verify every example mounts and renders in a real
 * browser without throwing or logging console errors. Per-feature
 * behavioral tests live in the package-level vitest suites; this layer
 * exists to catch regressions that JSDOM/happy-dom can't see (WAAPI
 * fastpath, real Canvas/WebGL, real layout, real prefers-reduced-motion).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 2 : undefined,
  reporter: process.env["CI"] ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  // The dev server boots fast; preview is closer to what users ship,
  // but `vite dev` is enough to catch the regressions this layer cares
  // about. Use `vite preview` after the build so we exercise the same
  // bundle path that production sees.
  webServer: {
    command: "pnpm --filter @kinem/examples-playground exec vite preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /devtools-extension\.spec\.ts$/,
    },
    {
      // Loads the built devtools extension into a persistent Chromium
      // context. Requires `pnpm --filter @kinem/devtools-extension build`
      // first; the spec's fixture errors out with a pointer to that
      // command if the dist bundle is missing.
      name: "devtools-extension",
      testMatch: /devtools-extension\.spec\.ts$/,
    },
  ],
})
