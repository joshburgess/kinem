/**
 * Playground runner. Lives inside the playground iframe. Accepts
 * `{ kind: "run", source }` postMessage envelopes from the parent
 * VitePress page, evaluates the source as an ES module, and reports
 * `"ready" | "ok" | "error"` envelopes back.
 *
 * Evaluation strategy: wrap the user source in a tiny preamble that
 * imports `@kinem/core` and exposes the stage element, then blob-URL
 * the result and `import()` it. Each run revokes the previous blob
 * URL. Before each run we cancel every animation the tracker knows
 * about and clear the stage, which gives us clean disposal without
 * asking the user to return a cleanup function.
 */

import * as kinem from "./kinem.mjs"

const stage = document.getElementById("stage")
const errorEl = document.getElementById("error")

// Surface the tracker so cleanup can cancel in-flight work.
kinem.enableTracker()

function showError(err) {
  errorEl.hidden = false
  errorEl.textContent = err?.stack ? err.stack : String(err)
}

function clearError() {
  errorEl.hidden = true
  errorEl.textContent = ""
}

function cancelAll() {
  for (const rec of kinem.listActiveAnimations()) {
    try {
      rec.controls.cancel()
    } catch {}
  }
}

function clearStage() {
  cancelAll()
  stage.textContent = ""
  stage.removeAttribute("style")
  stage.style.position = "absolute"
  stage.style.inset = "0"
  stage.style.overflow = "hidden"
  stage.style.padding = "16px"
}

let currentUrl = null

// Absolute URL for the kinem bundle. Blob-module imports resolve
// relatives against the blob URL itself (which has no path), so
// `./kinem.mjs` would 404. Resolve once, at runner boot, against
// the runner's own origin + path.
const KINEM_URL = new URL("./kinem.mjs", import.meta.url).href

async function run(source) {
  clearError()
  clearStage()

  const preamble = `
import * as kinem from ${JSON.stringify(KINEM_URL)}
const {
  play, tween, spring, keyframes, animation,
  parallel, sequence, stagger, loop, delay, reverse, map,
  timeline, scroll, gesture, splitText,
  playCanvas, playUniforms, strokeDraw,
  linear, easeIn, easeOut, easeInOut, cubicBezier, steps, springEasing,
  fromGrid, shuffle, wave,
  registerInterpolator, interpolate,
  subscribeTracker, listActiveAnimations,
} = kinem
const stage = document.getElementById("stage")
`

  const wrapped = `${preamble}\n${source}\n`

  try {
    const blob = new Blob([wrapped], { type: "application/javascript" })
    const url = URL.createObjectURL(blob)
    if (currentUrl) URL.revokeObjectURL(currentUrl)
    currentUrl = url
    await import(/* @vite-ignore */ url)
    post({ kind: "ok" })
  } catch (err) {
    showError(err)
    post({ kind: "error", message: String(err?.message ? err.message : err) })
  }
}

function post(msg) {
  try {
    parent.postMessage({ source: "kinem-runner", ...msg }, "*")
  } catch {}
}

window.addEventListener("message", (event) => {
  const data = event.data
  if (!data || typeof data !== "object") return
  if (data.source !== "kinem-playground") return
  if (data.kind === "run") run(String(data.code ?? ""))
  else if (data.kind === "clear") {
    clearError()
    clearStage()
  }
})

post({ kind: "ready" })
