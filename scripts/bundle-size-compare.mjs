#!/usr/bin/env node
/**
 * Cross-library bundle size comparison. Builds the same minimal recipe
 * ("fade an element's opacity from 0 to 1 over 800ms, then translate
 *  it 100px on x") against kinem (default + slim entry), motion, gsap,
 * popmotion, and anime.js. Reports min + gzip per library so the slope
 * is obvious.
 *
 * Like `bundle-size.mjs`, the absolute numbers depend on the bundler
 * and consumer setup. The point is the slope: kinem's `tween + play`
 * footprint should be a fraction of any general-purpose web animator.
 *
 * Competitor packages live in `benchmarks/browser/node_modules` so the
 * workspace root stays slim. We resolve via that subtree's
 * `node_modules` plus the workspace's pnpm store.
 *
 * Usage:
 *   pnpm size:compare
 *   pnpm size:compare --json
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"
import { build } from "esbuild"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const corePkg = resolve(root, "packages/core")
const coreEntry = resolve(corePkg, "src/index.ts")
const slimEntry = resolve(corePkg, "src/slim.ts")
const benchPkg = resolve(root, "benchmarks/browser")

/**
 * The recipe is intentionally tiny. Every entry below imports just
 * enough of its library to express "tween opacity 0 -> 1 + x 0 -> 100
 * over 800ms on a real DOM element". Whatever else the library hauls
 * in via its shared graph is the point of the measurement.
 */
const scenarios = [
  {
    name: "kinem (default)",
    resolveDir: corePkg,
    alias: { "@kinem/core": coreEntry },
    contents: `
import { play, tween } from "@kinem/core"
const el = document.body
const h = play(tween({ opacity: [0, 1], x: [0, 100] }, { duration: 800 }), el)
window.__sink = h
`,
  },
  {
    name: "kinem (slim)",
    resolveDir: corePkg,
    alias: { "@kinem/core": slimEntry },
    contents: `
import { play, tween } from "@kinem/core"
const el = document.body
const h = play(tween({ opacity: [0, 1], x: [0, 100] }, { duration: 800 }), el)
window.__sink = h
`,
  },
  {
    name: "motion",
    resolveDir: benchPkg,
    contents: `
import { animate } from "motion"
const el = document.body
const h = animate(el, { opacity: 1, x: 100 }, { duration: 0.8 })
window.__sink = h
`,
  },
  {
    name: "gsap",
    resolveDir: benchPkg,
    contents: `
import gsap from "gsap"
const el = document.body
const h = gsap.to(el, { opacity: 1, x: 100, duration: 0.8 })
window.__sink = h
`,
  },
  {
    name: "popmotion",
    resolveDir: benchPkg,
    contents: `
import { animate } from "popmotion"
const el = document.body
const h = animate({
  from: { opacity: 0, x: 0 },
  to: { opacity: 1, x: 100 },
  duration: 800,
  onUpdate: (v) => {
    el.style.opacity = String(v.opacity)
    el.style.transform = "translateX(" + v.x + "px)"
  },
})
window.__sink = h
`,
  },
  {
    name: "anime.js",
    resolveDir: benchPkg,
    contents: `
import { animate } from "animejs"
const el = document.body
const h = animate(el, { opacity: 1, x: 100, duration: 800 })
window.__sink = h
`,
  },
]

async function buildScenario(scenario) {
  return build({
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    minify: true,
    treeShaking: true,
    platform: "browser",
    stdin: {
      contents: scenario.contents,
      resolveDir: scenario.resolveDir,
      loader: "ts",
    },
    alias: scenario.alias,
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
    results.push({ name: scenario.name, minified, gzipped })
  }
  return results
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`
}

function printTable(results) {
  const baseline = results[0]?.gzipped ?? 1
  const headers = ["library", "min", "gzip", "vs kinem"]
  const rows = results.map((r) => [
    r.name,
    fmtKb(r.minified),
    fmtKb(r.gzipped),
    r.gzipped === baseline ? "1.00x" : `${(r.gzipped / baseline).toFixed(2)}x`,
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
  const results = await measureAll()
  if (asJson) {
    console.log(JSON.stringify({ results, generatedAt: new Date().toISOString() }, null, 2))
  } else {
    printTable(results)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
