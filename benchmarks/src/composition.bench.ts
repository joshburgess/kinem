import {
  type AnimationDef,
  easeOut,
  loop,
  parallel,
  sequence,
  spring,
  stagger,
  tween,
} from "@kinem/core"
import { bench, describe } from "vitest"

/**
 * Composition primitives: parallel / sequence / stagger / loop.
 *
 * Each combinator wraps children and routes a top-level progress value
 * through them. The construction cost amortizes (you build once, run
 * many frames), but `interpolate(p)` is on the per-frame hot path so
 * that's where regressions hurt. Both phases are measured.
 *
 * Numbers here interact with `mass-interpolation.bench.ts`: a 1000-
 * animation scene composed under a single `parallel(...)` is bound
 * mostly by these combinators rather than by individual leaf tweens.
 */

function makeLeaves(n: number): AnimationDef<{ x: number }>[] {
  const out: AnimationDef<{ x: number }>[] = []
  for (let i = 0; i < n; i++) {
    out.push(tween({ x: [0, 100 + i] }, { duration: 1000, easing: easeOut }))
  }
  return out
}

describe("parallel composition: 100 leaves", () => {
  const leaves = makeLeaves(100)
  const composed = parallel(...leaves)
  bench("build", () => {
    parallel(...leaves)
  })
  bench("interpolate(0.5)", () => {
    composed.interpolate(0.5)
  })
})

describe("parallel composition: 1000 leaves", () => {
  const leaves = makeLeaves(1000)
  const composed = parallel(...leaves)
  bench("build", () => {
    parallel(...leaves)
  })
  bench("interpolate(0.5)", () => {
    composed.interpolate(0.5)
  })
})

describe("sequence composition: 100 leaves", () => {
  const leaves = makeLeaves(100)
  const composed = sequence(...leaves)
  bench("build", () => {
    sequence(...leaves)
  })
  bench("interpolate(0.5)", () => {
    composed.interpolate(0.5)
  })
})

describe("stagger composition: 100 leaves", () => {
  const leaf = tween({ x: [0, 100] }, { duration: 1000 })
  const composed = stagger(leaf, { count: 100, each: 50 })
  bench("build (count=100)", () => {
    stagger(leaf, { count: 100, each: 50 })
  })
  bench("interpolate(0.5)", () => {
    composed.interpolate(0.5)
  })
})

describe("loop composition", () => {
  const leaf = tween({ x: [0, 100] }, { duration: 200 })
  const composed = loop(leaf, 10)
  bench("build", () => {
    loop(leaf, 10)
  })
  bench("interpolate(0.5)", () => {
    composed.interpolate(0.5)
  })
})

describe("spring construction + interpolate", () => {
  const def = spring({ x: [0, 100] }, { stiffness: 170, damping: 26 })
  bench("spring() construction", () => {
    spring({ x: [0, 100] }, { stiffness: 170, damping: 26 })
  })
  bench("spring.interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
})
