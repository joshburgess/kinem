/**
 * Build the showcase Vite app with the GH Pages sub-path baked in
 * (`/kinem/showcase/`) and copy the output into `docs/public/showcase/`.
 * VitePress passes `public/` through verbatim into the final dist, so
 * the showcase lives alongside the docs at `https://joshburgess.github.io/kinem/showcase/`.
 *
 * Run automatically before `vitepress build`. Set `DOCS_BASE` to override
 * the base path (e.g. `DOCS_BASE=/ pnpm -C docs build` for a root deploy).
 */

import { spawnSync } from "node:child_process"
import { cp, mkdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const docsRoot = resolve(dirname(__filename), "..")
const repoRoot = resolve(docsRoot, "..")
const showcasePkg = join(repoRoot, "examples", "showcase")
const showcaseDist = join(showcasePkg, "dist")
const outDir = join(docsRoot, "public", "showcase")

const docsBase = process.env.DOCS_BASE ?? "/"
// Trailing slash matters: Vite expects the base to end with "/".
const showcaseBase = `${docsBase.replace(/\/$/, "")}/showcase/`

console.log(`[docs] building showcase with SHOWCASE_BASE=${showcaseBase}`)
const result = spawnSync("pnpm", ["--filter", "@kinem/examples-showcase", "run", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, SHOWCASE_BASE: showcaseBase },
})
if (result.status !== 0) process.exit(result.status ?? 1)

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await cp(showcaseDist, outDir, { recursive: true })
console.log("[docs] showcase copied to", outDir)
