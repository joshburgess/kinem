#!/usr/bin/env node
/**
 * Headed-Chrome bench runner. Starts the Vite dev server programmatically,
 * launches Chrome (or bundled Chromium), navigates to the bench page, and
 * drives `window.__profileMain` / `window.__runMotif` / `__runMotion` /
 * `__runGsap` via `page.evaluate`.
 *
 * Beats the MCP route for perf work: the page stays foregrounded (no rAF
 * throttling), no CDP 45s ceiling, reproducible across runs.
 *
 * Usage:
 *   node scripts/bench.mjs profile [--n 1000] [--samples 7]
 *   node scripts/bench.mjs compare [--n 1000] [--samples 5]
 *
 * Flags:
 *   --channel=chromium   Use bundled Chromium instead of system Chrome
 *                        (default is channel=chrome; bundled is ~1 minor
 *                        behind your system Chrome but more reproducible
 *                        across machines).
 *   --headless           Run headless. NOT recommended for perf work:
 *                        composite/paint can behave differently.
 */

import { chromium } from "playwright"
import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const BENCH_ROOT = resolve(__dirname, "..")

const argv = process.argv.slice(2)
const command = argv[0]
const flag = (name, fallback) => {
  // Supports `--name`, `--name=value`, and `--name value`.
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === `--${name}`) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("--")) return next
      return true
    }
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3)
  }
  return fallback
}

const count = Number(flag("n", "1000"))
const samples = Number(flag("samples", command === "compare" ? "5" : "7"))
const channel = flag("channel", "chrome")
const headless = flag("headless", false) === true

const SCENARIOS = ["startup-commit", "startup-shared-def", "cancel-before-first", "steady-state"]
const LIBS = [
  { key: "motif-auto", fn: "__runMotif" },
  { key: "motif-main", fn: "__runMotifMain" },
  { key: "motion", fn: "__runMotion" },
  { key: "gsap", fn: "__runGsap" },
]

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

async function main() {
  if (!command || (command !== "profile" && command !== "compare")) {
    console.error("Usage: bench.mjs <profile|compare> [--n 1000] [--samples N]")
    process.exit(1)
  }

  console.log(`[bench] starting vite at ${BENCH_ROOT}`)
  // Override the config's strictPort:5178 so we don't collide with a
  // user-run `pnpm dev` on the same port. Pick any free port.
  const server = await createServer({
    root: BENCH_ROOT,
    configFile: resolve(BENCH_ROOT, "vite.config.ts"),
    logLevel: "error",
    server: { port: 0, strictPort: false },
  })
  await server.listen()
  const addr = server.httpServer?.address()
  const port = typeof addr === "object" && addr ? addr.port : 5178
  const url = `http://localhost:${port}/`
  console.log(`[bench] vite ready at ${url}`)

  console.log(`[bench] launching ${channel} (headless=${headless})`)
  const browser = await chromium.launch({
    headless,
    channel: channel === "chromium" ? undefined : channel,
  })

  let exitCode = 0
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(url, { waitUntil: "load" })
    await page.waitForFunction(
      () =>
        typeof window.__runMotif === "function" &&
        typeof window.__runMotifMain === "function" &&
        typeof window.__runGsap === "function" &&
        typeof window.__runMotion === "function" &&
        typeof window.__profileMain === "function",
      { timeout: 15_000 },
    )
    await page.bringToFront()

    if (command === "profile") {
      console.log(`[bench] profileMain n=${count} samples=${samples}`)
      const result = await page.evaluate(
        async ({ n, s }) => window.__profileMain(n, s),
        { n: count, s: samples },
      )
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`[bench] compare n=${count} samples=${samples}`)
      const results = {}
      // Warmup: one sample of each lib to shake out JIT / module init.
      for (const lib of LIBS) {
        await page.evaluate(
          async ({ fn, n }) => window[fn]("startup-commit", n),
          { fn: lib.fn, n: Math.min(100, count) },
        )
      }
      for (const scenario of SCENARIOS) {
        results[scenario] = {}
        for (const lib of LIBS) {
          const xs = []
          for (let i = 0; i < samples; i++) {
            const ms = await page.evaluate(
              async ({ fn, sc, n }) => window[fn](sc, n),
              { fn: lib.fn, sc: scenario, n: count },
            )
            xs.push(ms)
            await page.waitForTimeout(60)
          }
          results[scenario][lib.key] = {
            median: Number(median(xs).toFixed(2)),
            samples: xs.map((x) => Number(x.toFixed(2))),
          }
        }
      }
      printCompareTable(results)
      console.log("\nRaw JSON:")
      console.log(JSON.stringify(results, null, 2))
    }
  } catch (err) {
    console.error("[bench] error:", err)
    exitCode = 1
  } finally {
    await browser.close()
    await server.close()
    process.exit(exitCode)
  }
}

function printCompareTable(results) {
  const col = (s, w) => s.padEnd(w)
  const num = (n, w) => String(n.toFixed(1)).padStart(w)
  const headers = ["scenario", ...LIBS.map((l) => l.key)]
  const widths = [Math.max(...SCENARIOS.map((s) => s.length), 8), ...LIBS.map((l) => Math.max(l.key.length, 7))]
  console.log()
  console.log(headers.map((h, i) => col(h, widths[i])).join("  "))
  console.log(widths.map((w) => "-".repeat(w)).join("  "))
  for (const scenario of SCENARIOS) {
    const row = [col(scenario, widths[0])]
    for (let i = 0; i < LIBS.length; i++) {
      row.push(num(results[scenario][LIBS[i].key].median, widths[i + 1]))
    }
    console.log(row.join("  "))
  }
}

main()
