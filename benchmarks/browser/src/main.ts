/**
 * Browser-side comparison harness for kinem vs motion vs gsap.
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

import { type PlayMode, play, tween } from "@kinem/core"
import gsap from "gsap"
import { animate } from "motion"

type Scenario = "startup-commit" | "startup-shared-def" | "cancel-before-first" | "steady-state"

type Lib = "@kinem/core" | "motion" | "gsap"

type BenchResult = {
  lib: Lib
  scenario: Scenario
  count: number
  runs: number[]
  median: number
  mean: number
  min: number
  max: number
}

type ProfileSample = {
  tween: number
  play: number
  cancel: number
  total: number
  play_shared: number
  cancel_shared: number
  total_shared: number
}

type ProfileResult = {
  n: number
  samples: number
  median: ProfileSample
  all: ProfileSample[]
}

type StartupPhaseSample = {
  play: number
  tick: number
  cancel: number
  total: number
}

type StartupPhaseResult = {
  n: number
  samples: number
  scenario: "startup-commit" | "startup-shared-def"
  median: StartupPhaseSample
  all: StartupPhaseSample[]
}

declare global {
  interface Window {
    __bench?: BenchResult[]
    __runMotif?: (scenario: Scenario, count: number, mode?: PlayMode) => Promise<number>
    __runMotifMain?: (scenario: Scenario, count: number) => Promise<number>
    __runMotion?: (scenario: Scenario, count: number) => Promise<number>
    __runGsap?: (scenario: Scenario, count: number) => Promise<number>
    __clearStage?: () => void
    __profileMain?: (count: number, samples?: number) => Promise<ProfileResult>
    __profileStartupPhases?: (
      scenario: "startup-commit" | "startup-shared-def",
      count: number,
      samples?: number,
    ) => Promise<StartupPhaseResult>
  }
}

const stage = document.getElementById("stage") as HTMLDivElement
const out = document.getElementById("out") as HTMLPreElement
const countInput = document.getElementById("count") as HTMLInputElement
const scenarioSelect = document.getElementById("scenario") as HTMLSelectElement
const runMotifBtn = document.getElementById("run-kinem") as HTMLButtonElement
const runMotionBtn = document.getElementById("run-motion") as HTMLButtonElement
const runGsapBtn = document.getElementById("run-gsap") as HTMLButtonElement
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

async function runMotif(
  scenario: Scenario,
  count: number,
  mode: PlayMode = "auto",
): Promise<number> {
  const targets = spawnTargets(count)
  const start = performance.now()
  // biome-ignore lint/suspicious/noExplicitAny: union with handles we only need to cancel
  const handles = new Array<any>(count)
  if (scenario === "startup-shared-def") {
    // Real-world pattern: one def reused across N targets. Exercises the
    // planWaapi cache so each play() after the first reuses the keyframes.
    const def = tween({ opacity: [0, 1], x: [0, 100] }, { duration: 800 })
    for (let i = 0; i < count; i++) handles[i] = play(def, targets[i]!, { mode })
  } else {
    for (let i = 0; i < count; i++) {
      handles[i] = play(
        tween({ opacity: [0, 1], x: [0, 100 + i] }, { duration: 800 }),
        targets[i]!,
        { mode },
      )
    }
  }
  // No defensive `.finished.catch()` here: kinem's lazy-promise silences
  // unhandled-rejection surface internally for fire-and-forget cancel,
  // matching the motion and gsap bench paths which also don't catch.
  if (scenario === "cancel-before-first") {
    for (let i = 0; i < count; i++) handles[i]!.cancel()
  } else if (scenario === "startup-commit" || scenario === "startup-shared-def") {
    await nextFrame()
    for (let i = 0; i < count; i++) handles[i]!.cancel()
  } else {
    for (let k = 0; k < 10; k++) await nextFrame()
    for (let i = 0; i < count; i++) handles[i]!.cancel()
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

async function runGsap(scenario: Scenario, count: number): Promise<number> {
  const targets = spawnTargets(count)
  const start = performance.now()
  // biome-ignore lint/suspicious/noExplicitAny: gsap's tween type
  const handles = new Array<any>(count)
  if (scenario === "startup-shared-def") {
    // gsap has no reusable-def concept at the tween level; pass the
    // same vars object each time, which is the closest equivalent.
    const vars = { opacity: 1, x: 100, duration: 0.8 }
    for (let i = 0; i < count; i++) handles[i] = gsap.to(targets[i]!, vars)
  } else {
    for (let i = 0; i < count; i++) {
      handles[i] = gsap.to(targets[i]!, { opacity: 1, x: 100 + i, duration: 0.8 })
    }
  }
  if (scenario === "cancel-before-first") {
    for (let i = 0; i < count; i++) handles[i]!.kill()
  } else if (scenario === "startup-commit" || scenario === "startup-shared-def") {
    await nextFrame()
    for (let i = 0; i < count; i++) handles[i]!.kill()
  } else {
    for (let k = 0; k < 10; k++) await nextFrame()
    for (let i = 0; i < count; i++) handles[i]!.kill()
  }
  const elapsed = performance.now() - start
  clearStage()
  return elapsed
}

function summarize(lib: Lib, scenario: Scenario, count: number, runs: number[]): BenchResult {
  const sorted = [...runs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
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

async function runPool(lib: Lib, scenario: Scenario, count: number, samples = 5): Promise<void> {
  const runner = lib === "@kinem/core" ? runMotif : lib === "motion" ? runMotion : runGsap
  const runs: number[] = []
  for (let i = 0; i < samples; i++) {
    clearStage()
    const ms = await runner(scenario, count)
    runs.push(ms)
    // Settle between runs so GC / paint doesn't bleed into the next one.
    await nextFrame()
    await nextFrame()
  }
  report(summarize(lib, scenario, count, runs))
}

async function runHandler(lib: Lib): Promise<void> {
  const count = Math.max(1, Math.min(5000, Number(countInput.value) || 0))
  const scenario = scenarioSelect.value as Scenario
  runMotifBtn.disabled = true
  runMotionBtn.disabled = true
  runGsapBtn.disabled = true
  try {
    await runPool(lib, scenario, count)
  } finally {
    runMotifBtn.disabled = false
    runMotionBtn.disabled = false
    runGsapBtn.disabled = false
  }
}

async function profileMain(count: number, samples = 7): Promise<ProfileResult> {
  const oneSample = async (): Promise<ProfileSample> => {
    const targets = spawnTargets(count)
    const defs = new Array(count)
    // biome-ignore lint/suspicious/noExplicitAny: handle type union
    const handles = new Array<any>(count)

    const t0 = performance.now()
    for (let i = 0; i < count; i++) {
      defs[i] = tween({ opacity: [0, 1], x: [0, 100 + i] }, { duration: 800 })
    }
    const t1 = performance.now()
    for (let i = 0; i < count; i++) {
      handles[i] = play(defs[i], targets[i]!, { mode: "main" })
    }
    const t2 = performance.now()
    for (let i = 0; i < count; i++) {
      handles[i]!.cancel()
    }
    const t3 = performance.now()
    clearStage()

    const sharedDef = tween({ opacity: [0, 1], x: [0, 100] }, { duration: 800 })
    const targets2 = spawnTargets(count)
    // biome-ignore lint/suspicious/noExplicitAny: handle type union
    const handles2 = new Array<any>(count)
    const u0 = performance.now()
    for (let i = 0; i < count; i++) {
      handles2[i] = play(sharedDef, targets2[i]!, { mode: "main" })
    }
    const u1 = performance.now()
    for (let i = 0; i < count; i++) {
      handles2[i]!.cancel()
    }
    const u2 = performance.now()
    clearStage()

    return {
      tween: t1 - t0,
      play: t2 - t1,
      cancel: t3 - t2,
      total: t3 - t0,
      play_shared: u1 - u0,
      cancel_shared: u2 - u1,
      total_shared: u2 - u0,
    }
  }

  // Warmup. Use setTimeout between samples instead of requestAnimationFrame,
  // since this runner is driven from the MCP extension with the tab often
  // backgrounded — rAF is throttled to ~1/sec under that condition.
  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30))

  await oneSample()
  await settle()

  const all: ProfileSample[] = []
  for (let i = 0; i < samples; i++) {
    all.push(await oneSample())
    await settle()
  }

  const median = (key: keyof ProfileSample): number => {
    const arr = all.map((s) => s[key]).sort((a, b) => a - b)
    return +(arr[Math.floor(arr.length / 2)] ?? 0).toFixed(2)
  }

  return {
    n: count,
    samples: all.length,
    median: {
      tween: median("tween"),
      play: median("play"),
      cancel: median("cancel"),
      total: median("total"),
      play_shared: median("play_shared"),
      cancel_shared: median("cancel_shared"),
      total_shared: median("total_shared"),
    },
    all: all.map((s) => ({
      tween: +s.tween.toFixed(2),
      play: +s.play.toFixed(2),
      cancel: +s.cancel.toFixed(2),
      total: +s.total.toFixed(2),
      play_shared: +s.play_shared.toFixed(2),
      cancel_shared: +s.cancel_shared.toFixed(2),
      total_shared: +s.total_shared.toFixed(2),
    })),
  }
}

async function profileStartupPhases(
  scenario: "startup-commit" | "startup-shared-def",
  count: number,
  samples = 7,
): Promise<StartupPhaseResult> {
  const oneSample = async (): Promise<StartupPhaseSample> => {
    const targets = spawnTargets(count)
    // biome-ignore lint/suspicious/noExplicitAny: handle type union
    const handles = new Array<any>(count)

    const t0 = performance.now()
    if (scenario === "startup-shared-def") {
      const def = tween({ opacity: [0, 1], x: [0, 100] }, { duration: 800 })
      for (let i = 0; i < count; i++) {
        handles[i] = play(def, targets[i]!, { mode: "main" })
      }
    } else {
      for (let i = 0; i < count; i++) {
        handles[i] = play(
          tween({ opacity: [0, 1], x: [0, 100 + i] }, { duration: 800 }),
          targets[i]!,
          { mode: "main" },
        )
      }
    }
    const t1 = performance.now()

    await nextFrame()
    const t2 = performance.now()

    for (let i = 0; i < count; i++) handles[i]!.cancel()
    const t3 = performance.now()

    clearStage()
    return {
      play: t1 - t0,
      tick: t2 - t1,
      cancel: t3 - t2,
      total: t3 - t0,
    }
  }

  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30))

  // Warmup.
  await oneSample()
  await settle()

  const all: StartupPhaseSample[] = []
  for (let i = 0; i < samples; i++) {
    all.push(await oneSample())
    await settle()
  }

  const med = (key: keyof StartupPhaseSample): number => {
    const arr = all.map((s) => s[key]).sort((a, b) => a - b)
    return +(arr[Math.floor(arr.length / 2)] ?? 0).toFixed(2)
  }

  return {
    n: count,
    samples: all.length,
    scenario,
    median: {
      play: med("play"),
      tick: med("tick"),
      cancel: med("cancel"),
      total: med("total"),
    },
    all: all.map((s) => ({
      play: +s.play.toFixed(2),
      tick: +s.tick.toFixed(2),
      cancel: +s.cancel.toFixed(2),
      total: +s.total.toFixed(2),
    })),
  }
}

window.__runMotif = runMotif
window.__runMotifMain = (scenario, count) => runMotif(scenario, count, "main")
window.__runMotion = runMotion
window.__runGsap = runGsap
window.__clearStage = clearStage
window.__profileMain = profileMain
window.__profileStartupPhases = profileStartupPhases

runMotifBtn.addEventListener("click", () => {
  void runHandler("@kinem/core")
})
runMotionBtn.addEventListener("click", () => {
  void runHandler("motion")
})
runGsapBtn.addEventListener("click", () => {
  void runHandler("gsap")
})
clearBtn.addEventListener("click", () => {
  out.textContent = "ready."
  clearStage()
  window.__bench = []
})
