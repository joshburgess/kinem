// @vitest-environment happy-dom

import { interpolateNumber, play, tween } from "kinem"
import { animate } from "motion"
// motion-dom is installed transitively via `motion`. Its `mix()` is the
// primitive we compare against kinem's `interpolateNumber()`, and
// `flushKeyframeResolvers()` is the public hook that forces motion's
// deferred setup to run synchronously.
import { flushKeyframeResolvers, mix } from "motion-dom"
import { bench, describe } from "vitest"

/**
 * Comparison against Motion (framer-motion / motion-dom). Both libs
 * are pointed at the same synthetic HTMLElements in a happy-dom
 * environment. WAAPI is stubbed here, so anything that depends on real
 * keyframe parsing or compositor execution is not captured. See the
 * waapi-fastpath bench for the CPU side of keyframe building and the
 * mass-concurrent bench for steady-state rAF tick cost.
 *
 * Each group below isolates one cost:
 *
 *   1. Primitive interpolation — apples-to-apples function-call cost.
 *   2. Startup (fair)          — flush motion's deferred resolver so
 *                                both libs have completed the real
 *                                setup before we cancel. Measures
 *                                actual library overhead.
 *   3. Startup (lazy)          — sync animate + cancel, no flush.
 *                                Documents motion's deferred-setup
 *                                short-circuit: when rAF never runs,
 *                                motion skips Element.animate() and
 *                                .stop() is a cancel-flag flip. Kinem
 *                                does the real work eagerly, so it
 *                                looks slower here. This is the cost
 *                                model motion wins on structurally.
 *
 * We also try to keep the per-call shapes matched: 2 properties, one
 * compositor-safe (opacity) and one pseudo-transform (x), 1s / 1s
 * duration (motion uses seconds, kinem uses ms; both = 1000ms).
 */

function makeElements(n: number): HTMLElement[] {
  const els = new Array<HTMLElement>(n)
  for (let i = 0; i < n; i++) els[i] = document.createElement("div")
  return els
}

describe("pure interpolation: number", () => {
  const motifFn = interpolateNumber(0, 100)
  const motionFn = mix(0, 100)
  bench("kinem: interpolateNumber(0, 100)(p)", () => {
    motifFn(0.5)
  })
  bench("motion: mix(0, 100)(p)", () => {
    motionFn(0.5)
  })
})

for (const n of [10, 100, 500]) {
  describe(`startup — fair (both libs finish setup): ${n} animations`, () => {
    const motifDefault = makeElements(n)
    const motifRaf = makeElements(n)
    const motionEls = makeElements(n)
    bench("kinem: play(tween) — auto backend", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(
          tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 }),
          motifDefault[i]!,
        )
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
    bench("kinem: play(tween) — rAF backend", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 }), motifRaf[i]!, {
          backend: "raf",
        })
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
    bench("motion: animate(...) + flush + stop()", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = animate(motionEls[i]!, { x: 100, opacity: 1 }, { duration: 1 })
      }
      flushKeyframeResolvers()
      for (let i = 0; i < n; i++) cs[i].stop()
    })
  })

  describe(`startup — lazy (cancel before first frame): ${n} animations`, () => {
    // Both libs defer the backend setup (Element.animate / keyframe
    // resolution) to the first scheduler tick. The remaining delta is
    // synchronous work kinem performs that motion doesn't: constructing
    // the PromiseLike Controls wrapper and registering with the built-
    // in tracker (so devtools can list active animations at any time).
    // Motion returns a thinner handle. The gap represents those feature
    // costs, not wasted work.
    const motifEls = makeElements(n)
    const motionEls = makeElements(n)
    bench("kinem: play(tween).cancel() — lazy WAAPI, eager controls+tracker", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 }), motifEls[i]!)
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
    bench("motion: animate(...).stop() — deferred setup never runs", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = animate(motionEls[i]!, { x: 100, opacity: 1 }, { duration: 1 })
      }
      for (let i = 0; i < n; i++) cs[i].stop()
    })
  })
}
