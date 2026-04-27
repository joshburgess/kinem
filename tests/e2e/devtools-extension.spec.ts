import { existsSync } from "node:fs"
import path from "node:path"
import { type BrowserContext, test as base, chromium, expect } from "@playwright/test"

/**
 * End-to-end smoke test for the devtools extension. The unit suite
 * covers the agent's wire protocol against a hand-rolled hook; this
 * layer exists to confirm the manifest loads, the agent script gets
 * injected into the MAIN world at document_start, and it picks up the
 * page's `__KINEM_DEVTOOLS_HOOK__` and posts the hello/snapshot pair.
 *
 * What this does NOT cover: the DevTools panel UI, the content-script
 * relay into the background service worker, or panel-command
 * round-tripping. The DevTools UI itself isn't directly drivable from
 * Playwright without significant gymnastics; the goal here is the
 * narrower one of "the agent runs in real Chrome the way the unit
 * tests assume it does."
 */

// Playwright transpiles spec files as CJS (the repo root has no
// `"type": "module"`), so `__dirname` is defined at runtime.
declare const __dirname: string
const EXTENSION_DIR = path.resolve(__dirname, "../../packages/devtools-extension/dist")

const test = base.extend<{ context: BrowserContext }>({
  context: async ({ browser: _ }, use) => {
    if (!existsSync(path.join(EXTENSION_DIR, "agent.js"))) {
      throw new Error(
        `Built extension not found at ${EXTENSION_DIR}. Run: pnpm --filter @kinem/devtools-extension build`,
      )
    }
    // `channel: 'chromium'` switches Playwright off the headless-shell
    // variant onto full Chromium, which is what supports extensions in
    // the new headless mode (Chromium 109+).
    const context = await chromium.launchPersistentContext("", {
      headless: true,
      channel: "chromium",
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    })
    await use(context)
    await context.close()
  },
})

test.describe("devtools-extension agent injection", () => {
  test("agent boots, finds the hook, and posts hello + initial snapshot", async ({ context }) => {
    const page = await context.newPage()

    // Install the fake hook and the postMessage listener BEFORE any
    // page or content script runs. addInitScript is hooked into the
    // page's script-context creation, which happens before
    // document_start content scripts execute.
    await page.addInitScript(() => {
      const captured: unknown[] = []
      Object.defineProperty(globalThis, "__KINEM_TEST_AGENT_MSGS__", {
        value: captured,
        writable: false,
      })
      window.addEventListener("message", (e) => {
        const data = e.data as { source?: string } | null
        if (data && typeof data === "object" && data.source === "kinem-agent") {
          captured.push(data)
        }
      })
      Object.defineProperty(globalThis, "__KINEM_DEVTOOLS_HOOK__", {
        value: {
          version: 1,
          listActive: () => [],
          subscribe: () => () => {},
        },
        writable: false,
      })
    })

    await page.goto("/")

    await page.waitForFunction(
      () => {
        const msgs = (globalThis as { __KINEM_TEST_AGENT_MSGS__?: { event?: { kind?: string } }[] })
          .__KINEM_TEST_AGENT_MSGS__
        return Array.isArray(msgs) && msgs.some((m) => m.event?.kind === "hello")
      },
      undefined,
      { timeout: 10_000 },
    )

    type CapturedMsg = { source: string; event: { kind: string; hookVersion?: number } }
    const messages = (await page.evaluate(
      () =>
        (globalThis as { __KINEM_TEST_AGENT_MSGS__?: CapturedMsg[] }).__KINEM_TEST_AGENT_MSGS__ ??
        [],
    )) as CapturedMsg[]

    const hello = messages.find((m) => m.event.kind === "hello")
    expect(hello).toBeDefined()
    expect(hello?.event.hookVersion).toBe(1)

    const snapshot = messages.find((m) => m.event.kind === "snapshot")
    expect(snapshot).toBeDefined()
  })
})
