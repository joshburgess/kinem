/**
 * Extension build. esbuild emits one bundle per entry; static files
 * (manifest, HTML, CSS, icons) are copied verbatim. `--watch` wires
 * esbuild's watch API and re-copies static assets on a debounce.
 *
 * Output layout is flat (Chrome expects `manifest.json` at the root of
 * the unpacked directory). Entries are emitted directly into `dist/`
 * with their basename: `agent.js`, `content.js`, `background.js`,
 * `devtools.js`, `panel.js`.
 */

import { existsSync } from "node:fs"
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build, context } from "esbuild"

const __filename = fileURLToPath(import.meta.url)
const root = resolve(dirname(__filename), "..")
const outDir = join(root, "dist")

const entries = [
  "src/agent.ts",
  "src/content.ts",
  "src/background.ts",
  "src/devtools.ts",
  "src/panel.ts",
]

const staticFiles = [
  ["manifest.json", "manifest.json"],
  ["src/devtools.html", "devtools.html"],
  ["src/panel.html", "panel.html"],
  ["src/panel.css", "panel.css"],
]

async function copyStatic() {
  for (const [src, dest] of staticFiles) {
    const s = join(root, src)
    const d = join(outDir, dest)
    await mkdir(dirname(d), { recursive: true })
    await cp(s, d)
  }
  const icons = join(root, "icons")
  if (existsSync(icons)) {
    const entries = await readdir(icons)
    if (entries.length > 0) {
      await cp(icons, join(outDir, "icons"), { recursive: true })
    }
  }
}

const sharedOpts = {
  bundle: true,
  format: "iife",
  target: "chrome111",
  logLevel: "info",
  sourcemap: "linked",
  legalComments: "none",
}

async function run() {
  const watch = process.argv.includes("--watch")
  if (existsSync(outDir)) await rm(outDir, { recursive: true })
  await mkdir(outDir, { recursive: true })

  if (watch) {
    const ctx = await context({
      ...sharedOpts,
      entryPoints: entries.map((e) => join(root, e)),
      outdir: outDir,
    })
    await ctx.watch()
    await copyStatic()
    console.log("[kinem-devtools-extension] watching…")
    return
  }

  await build({
    ...sharedOpts,
    entryPoints: entries.map((e) => join(root, e)),
    outdir: outDir,
  })
  await copyStatic()
  const s = await stat(outDir)
  if (!s.isDirectory()) throw new Error("dist is not a directory")
  console.log("[kinem-devtools-extension] built to", outDir)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
