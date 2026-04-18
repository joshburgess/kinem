/**
 * Browser-side comparison harness for motif vs motion.
 *
 * Three scenarios:
 *
 *   1. startup + first commit — create N animations, wait for the first
 *      rAF to fire (so WAAPI / keyframe resolvers actually run), then
 *      stop. Captures real setup cost with a real compositor involved.
 *
 *   2. cancel before first frame — create N animations and stop them
 *      synchronously before any rAF fires. Both libraries should
 *      short-circuit their deferred setup in this case; the delta is
 *      the unavoidable synchronous per-call cost each library pays.
 *
 *   3. steady-state (10 frames) — create N animations, yield 10 frames,
 *      measure end-to-end wall time.
 *
 * Each run is repeated 5 times and the median is reported, to smooth
 * out noise from GC and paint. The stage is cleared between runs.
 *
 * The harness writes results to a <pre> element and also to
 * `window.__bench` for pickup by automation (e.g. chrome-devtools MCP).
 */

import { play, tween } from "motif-animate"
import { animate } from "motion"

type Scenario =
  | "startup-commit"
  | "startup-shared-def"
  | "cancel-before-first"
  | "steady-state"

type BenchResult = {
  lib: "motif" | "motion"
  scenario: Scenario
  count: number
  runs: number[]
  median: number
  mean: number
  min: number
  max: number
}

declare global {
  interface Window {
    __bench?: BenchResult[]
    __runMotif?: (scenario: Scenario, count: number) => Promise<number>
    __runMotion?: (scenario: Scenario, count: number) => Promise<number>
    __clearStage?: () => void
  }
}

const stage = document.getElementById("stage") as HTMLDivElement
const out = document.getElementById("out") as HTMLPreElement
const countInput = document.getElementById("count") as HTMLInputElement
const scenarioSelect = document.getElementById("scenario") as HTMLSelectElement
const runMotifBtn = document.getElementById("run-motif") as HTMLButtonElement
const runMotionBtn = document.getElementById("run-motion") as HTMLButtonElement
const clearBtn = document.getElementById("clear") as HTMLButtonElement

window.__bench = []

function clearStage(): void {
  stage.textContent = ""
}

function spawnTargets(n: number): HTMLDivElement[] {
  const els = new Array<HTMLDivElement>(n)
  const frag = document.createDocumentFragment()
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div")
    el.className = "box"
    el.style.left = `${(i % 40) * 16}px`
    el.style.top = `${Math.floor(i / 40) * 16}px`
    el.style.color = `hsl(${(i * 137.5) % 360} 80% 55%)`
    els[i] = el
    frag.appendChild(el)
  }
  stage.appendChild(frag)
  return els
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function runMotif(scenario: Scenario, count: number): Promise<number> {
  const targets = spawnTargets(count)
  const start = performance.now()
  // biome-ignore lint/suspicious/noExplicitAny: union with handles we only need to cancel
  const handles = new Array<any>(count)
  if (scenario === "startup-shared-def") {
    // Real-world pattern: one def reused across N targets. Exercises the
    // planWaapi cache so each play() after the first reuses the keyframes.
    const def = tween({ opacity: [0, 1], x: [0, 100] }, { duration: 800 })
    for (let i = 0; i < count; i++) handles[i] = play(def, targets[i]!)
  } else {
    for (let i = 0; i < count; i++) {
      handles[i] = play(
        tween({ opacity: [0, 1], x: [0, 100 + i] }, { duration: 800 }),
        targets[i]!,
      )
    }
  }
  if (scenario === "cancel-before-first") {
    for (let i = 0; i < count; i++) {
      handles[i]!.finished.catch(() => {})
      handles[i]!.cancel()
    }
  } else if (scenario === "startup-commit" || scenario === "startup-shared-def") {
    await nextFrame()
    for (let i = 0; i < count; i++) {
      handles[i]!.finished.catch(() => {})
      handles[i]!.cancel()
    }
  } else {
    for (let k = 0; k < 10; k++) await nextFrame()
    for (let i = 0; i < count; i++) {
      handles[i]!.finished.catch(() => {})
      handles[i]!.cancel()
    }
  }
  const elapsed = performance.now() - start
  clearStage()
  return elapsed
}

async function runMotion(scenario: Scenario, count: number): Promise<number> {
  const targets = spawnTargets(count)
  const start = performance.now()
  // biome-ignore lint/suspicious/noExplicitAny: motion's handle type
  const handles = new Array<any>(count)
  if (scenario === "startup-shared-def") {
    // motion has no "reusable def" handle; closest equivalent is passing
    // the same object literal each time. Keep the work symmetrical.
    const props = { opacity: 1, x: 100 }
    const opts = { duration: 0.8 }
    for (let i = 0; i < count; i++) handles[i] = animate(targets[i]!, props, opts)
  } else {
    for (let i = 0; i < count; i++) {
      handles[i] = animate(targets[i]!, { opacity: 1, x: 100 + i }, { duration: 0.8 })
    }
  }
  if (scenario === "cancel-before-first") {
    for (let i = 0; i < count; i++) handles[i]!.stop()
  } else if (scenario === "startup-commit" || scenario === "startup-shared-def") {
    await nextFrame()
    for (let i = 0; i < count; i++) handles[i]!.stop()
  } else {
    for (let k = 0; k < 10; k++) await nextFrame()
    for (let i = 0; i < count; i++) handles[i]!.stop()
  }
  const elapsed = performance.now() - start
  clearStage()
  return elapsed
}

function summarize(
  lib: "motif" | "motion",
  scenario: Scenario,
  count: number,
  runs: number[],
): BenchResult {
  const sorted = [...runs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length
  const min = sorted[0] ?? 0
  const max = sorted[sorted.length - 1] ?? 0
  return { lib, scenario, count, runs, median, mean, min, max }
}

function report(result: BenchResult): void {
  const fmt = (x: number): string => x.toFixed(2).padStart(7)
  const line = `[${result.lib}] ${result.scenario.padEnd(22)} n=${String(result.count).padStart(5)}  median=${fmt(result.median)}ms  mean=${fmt(result.mean)}ms  min=${fmt(result.min)}ms  max=${fmt(result.max)}ms`
  out.textContent += `\n${line}`
  window.__bench?.push(result)
}

async function runPool(
  lib: "motif" | "motion",
  scenario: Scenario,
  count: number,
  samples = 5,
): Promise<void> {
  const runs: number[] = []
  for (let i = 0; i < samples; i++) {
    clearStage()
    const ms = lib === "motif" ? await runMotif(scenario, count) : await runMotion(scenario, count)
    runs.push(ms)
    // Settle between runs so GC / paint doesn't bleed into the next one.
    await nextFrame()
    await nextFrame()
  }
  report(summarize(lib, scenario, count, runs))
}

async function runHandler(lib: "motif" | "motion"): Promise<void> {
  const count = Math.max(1, Math.min(5000, Number(countInput.value) || 0))
  const scenario = scenarioSelect.value as Scenario
  runMotifBtn.disabled = true
  runMotionBtn.disabled = true
  try {
    await runPool(lib, scenario, count)
  } finally {
    runMotifBtn.disabled = false
    runMotionBtn.disabled = false
  }
}

window.__runMotif = runMotif
window.__runMotion = runMotion
window.__clearStage = clearStage

runMotifBtn.addEventListener("click", () => {
  void runHandler("motif")
})
runMotionBtn.addEventListener("click", () => {
  void runHandler("motion")
})
clearBtn.addEventListener("click", () => {
  out.textContent = "ready."
  clearStage()
  window.__bench = []
})
