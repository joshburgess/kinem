import { type AnimationDef, type WorkerAnimSpec, computeValues, linear, tween } from "motif-animate"
import { bench, describe } from "vitest"

/**
 * Measures the raw cost of interpolating N independent numeric animations
 * at a single point in time. This is the inner loop that drives every
 * frame in large scenes, so its throughput matters far more than any
 * single driver primitive. Two shapes are compared:
 *
 *   - `computeValues` with serializable `WorkerAnimSpec`s (the shape
 *     sent to a Worker); intentionally restricted to numeric easing ids.
 *   - `tween(...).interpolate(p)` with the full AnimationDef pipeline,
 *     which supports arbitrary string and unit interpolation.
 *
 * The gap between them is the ceiling on what a worker thread could win
 * back on numeric-only animations.
 */

function makeSpecs(n: number): WorkerAnimSpec[] {
  const specs: WorkerAnimSpec[] = []
  for (let i = 0; i < n; i++) {
    specs.push({
      id: `el${i}`,
      startTime: 0,
      duration: 1000,
      easing: "ease-out",
      properties: { x: [0, i], y: [0, i * 2], opacity: [0, 1] },
    })
  }
  return specs
}

function makeTweens(n: number): AnimationDef<Record<string, string>>[] {
  const defs: AnimationDef<Record<string, string>>[] = []
  for (let i = 0; i < n; i++) {
    defs.push(
      tween(
        {
          x: [`${0}px`, `${i}px`],
          y: [`${0}px`, `${i * 2}px`],
          opacity: ["0", "1"],
        },
        { duration: 1000, easing: linear },
      ),
    )
  }
  return defs
}

function runTweens(defs: AnimationDef<Record<string, string>>[], p: number): void {
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]
    if (def) def.interpolate(p)
  }
}

describe("mass interpolation: 100 animations", () => {
  const specs = makeSpecs(100)
  const defs = makeTweens(100)
  bench("computeValues (worker-shaped)", () => {
    computeValues(specs, 500)
  })
  bench("tween.interpolate (full pipeline)", () => {
    runTweens(defs, 0.5)
  })
})

describe("mass interpolation: 500 animations", () => {
  const specs = makeSpecs(500)
  const defs = makeTweens(500)
  bench("computeValues (worker-shaped)", () => {
    computeValues(specs, 500)
  })
  bench("tween.interpolate (full pipeline)", () => {
    runTweens(defs, 0.5)
  })
})

describe("mass interpolation: 1000 animations", () => {
  const specs = makeSpecs(1000)
  const defs = makeTweens(1000)
  bench("computeValues (worker-shaped)", () => {
    computeValues(specs, 500)
  })
  bench("tween.interpolate (full pipeline)", () => {
    runTweens(defs, 0.5)
  })
})

/**
 * Startup cost: how long to parse and prepare 1000 AnimationDefs.
 * This is a one-time cost per scene and matters most for LCP-sensitive
 * pages (e.g., landing page entrance animations).
 */
describe("startup: prepare 1000 animations", () => {
  bench("tween() construction", () => {
    makeTweens(1000)
  })
  bench("WorkerAnimSpec construction", () => {
    makeSpecs(1000)
  })
})
