/**
 * Bundle `@kinem/core` (and the slim entry) as standalone ES modules
 * for the docs playground. Written directly into `docs/public/playground/`
 * so VitePress serves them from `/playground/kinem.mjs` and
 * `/playground/kinem-slim.mjs`.
 *
 * Run automatically before `vitepress dev` and `vitepress build`. Safe
 * to run repeatedly: the output is overwritten each time.
 */

import { cp, mkdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const __filename = fileURLToPath(import.meta.url)
const docsRoot = resolve(dirname(__filename), "..")
const repoRoot = resolve(docsRoot, "..")
const outDir = join(docsRoot, "public", "playground")
const corePkg = join(repoRoot, "packages", "core")

const shared = {
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "browser",
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  minify: true,
}

async function run() {
  await mkdir(outDir, { recursive: true })
  await build({
    ...shared,
    entryPoints: [join(corePkg, "src", "index.ts")],
    outfile: join(outDir, "kinem.mjs"),
  })
  await build({
    ...shared,
    entryPoints: [join(corePkg, "src", "slim.ts")],
    outfile: join(outDir, "kinem-slim.mjs"),
  })

  const runnerSrc = join(docsRoot, ".vitepress", "playground-runner")
  await cp(join(runnerSrc, "runner.html"), join(outDir, "runner.html"))
  await cp(join(runnerSrc, "runner.js"), join(outDir, "runner.js"))
  await cp(join(runnerSrc, "runner.css"), join(outDir, "runner.css"))
  console.log("[docs] playground assets written to", outDir)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
