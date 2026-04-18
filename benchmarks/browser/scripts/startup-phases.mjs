#!/usr/bin/env node
import { chromium } from "playwright"
import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const BENCH_ROOT = resolve(__dirname, "..")

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
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
const samples = Number(flag("samples", "7"))
const channel = flag("channel", "chrome")

async function main() {
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
  console.log(`[phases] vite ready at ${url}`)

  const browser = await chromium.launch({
    headless: false,
    channel: channel === "chromium" ? undefined : channel,
  })

  let exitCode = 0
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(url, { waitUntil: "load" })
    await page.waitForFunction(
      () => typeof window.__profileStartupPhases === "function",
      { timeout: 15_000 },
    )
    await page.bringToFront()

    for (const scenario of ["startup-commit", "startup-shared-def"]) {
      console.log(`\n[phases] scenario=${scenario} n=${count} samples=${samples}`)
      const result = await page.evaluate(
        async ({ sc, n, s }) => window.__profileStartupPhases(sc, n, s),
        { sc: scenario, n: count, s: samples },
      )
      console.log(JSON.stringify(result, null, 2))
    }
  } catch (err) {
    console.error("[phases] error:", err)
    exitCode = 1
  } finally {
    await browser.close()
    await server.close()
    process.exit(exitCode)
  }
}

main()
