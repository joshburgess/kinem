#!/usr/bin/env node
/**
 * Bundle size audit. Builds a handful of virtual entry points that each
 * import a named subset of `@kinem/core`, then reports the minified +
 * gzipped byte count per subset.
 *
 * Runs esbuild on each scenario with:
 *   - the local workspace `src/index.ts` as the real source
 *   - aggressive minification and tree-shaking enabled
 *   - ESM output targeted at modern browsers (es2022)
 *
 * The point is not absolute accuracy vs a consumer's bundle, which
 * depends on their toolchain, but the slope: if a PR adds 2 kB to the
 * `tween + play` footprint, this script will catch it.
 *
 * Usage:
 *   pnpm size           — print the table
 *   pnpm size --json    — machine-readable JSON for CI
 *   pnpm size --check   — exit 1 if any scenario exceeds its target
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"
import { build } from "esbuild"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, "..")
const corePkg = resolve(root, "packages/core")
const coreEntry = resolve(corePkg, "src/index.ts")
const slimEntry = resolve(corePkg, "src/slim.ts")

/**
 * Each scenario gets a tiny inline ES module that imports only the named
 * symbols from the library, plus a trivial `console.log` sink so the
 * bundler can't drop the imports as unused. Targets come from the build
 * plan (Phase 3.3).
 */
const scenarios = [
  {
    name: "tween + play",
    targetKb: 3,
    imports: ["tween", "play", "linear", "easeInOut"],
  },
  {
    name: "tween + play (slim)",
    targetKb: 3,
    entry: slimEntry,
    imports: ["tween", "play", "linear", "easeInOut"],
  },
  {
    name: "tween + scroll",
    targetKb: 5,
    imports: ["tween", "play", "scroll", "linear", "easeInOut"],
  },
  {
    name: "tween + gesture",
    targetKb: 7,
    imports: ["tween", "play", "gesture", "linear", "easeInOut"],
  },
  {
    name: "full library",
    targetKb: 12,
    imports: [
      "tween",
      "spring",
      "keyframes",
      "play",
      "timeline",
      "scroll",
      "gesture",
      "parallel",
      "sequence",
      "stagger",
      "loop",
      "delay",
      "reverse",
      "createFrameScheduler",
      "createClock",
      "interpolate",
      "registerInterpolator",
      "applyValues",
      "playStrategy",
      "playWaapi",
      "playRaf",
      "computeValues",
      "createWorkerComputer",
    ],
  },
]

function buildScenario(scenario) {
  const namedImports = scenario.imports.join(", ")
  const entryContent = `
import { ${namedImports} } from "@kinem/core"
// Keep each import alive so esbuild won't prune it.
const sink = [${namedImports}]
if (typeof window !== "undefined") {
  // Side effect that depends on every import, preventing DCE.
  window.__motif_sink = sink
}
export default sink
`
  return build({
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    minify: true,
    treeShaking: true,
    platform: "browser",
    stdin: {
      contents: entryContent,
      resolveDir: corePkg,
      loader: "ts",
    },
    alias: { "@kinem/core": scenario.entry ?? coreEntry },
    logLevel: "silent",
  })
}

async function measureAll() {
  const results = []
  for (const scenario of scenarios) {
    const bundle = await buildScenario(scenario)
    const code = bundle.outputFiles[0]?.contents ?? new Uint8Array()
    const minified = code.byteLength
    const gzipped = gzipSync(code, { level: 9 }).byteLength
    results.push({
      name: scenario.name,
      minified,
      gzipped,
      targetKb: scenario.targetKb,
      overBudget: gzipped / 1024 > scenario.targetKb,
    })
  }
  return results
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`
}

function printTable(results) {
  const headers = ["scenario", "min", "gzip", "target", "status"]
  const rows = results.map((r) => [
    r.name,
    fmtKb(r.minified),
    fmtKb(r.gzipped),
    `${r.targetKb.toFixed(1)} kB`,
    r.overBudget ? "OVER" : "ok",
  ])
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)))
  const pad = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ")
  console.log(pad(headers))
  console.log(pad(widths.map((w) => "-".repeat(w))))
  for (const row of rows) console.log(pad(row))
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--")
  const asJson = args.includes("--json")
  const check = args.includes("--check")

  const results = await measureAll()

  if (asJson) {
    console.log(JSON.stringify({ results, generatedAt: new Date().toISOString() }, null, 2))
  } else {
    printTable(results)
  }

  if (check) {
    const over = results.filter((r) => r.overBudget)
    if (over.length > 0) {
      console.error(`\n${over.length} scenario(s) over budget:`)
      for (const r of over) {
        console.error(`  ${r.name}: ${fmtKb(r.gzipped)} > ${r.targetKb} kB`)
      }
      process.exit(1)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
