// @vitest-environment happy-dom

import { buildKeyframes, cubicBezier, easeOut, play, tween } from "@kinem/core"
import { bench, describe } from "vitest"

/**
 * Isolate the WAAPI fast path. Two tweens of identical shape but
 * different easings: one `cubicBezier(...)` (linearizable → 2 keyframes
 * + CSS timing) and one `easeOut` (kinem quadratic → dense sampling).
 */

describe("buildKeyframes: sample density", () => {
  const def1s = tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 })
  bench("dense sampling (default, ~64 frames for 1s)", () => {
    buildKeyframes(def1s)
  })
  bench("forced 2 frames", () => {
    buildKeyframes(def1s, { minSamples: 2, maxSamples: 2 })
  })
})

function makeElements(n: number): HTMLElement[] {
  const els = new Array<HTMLElement>(n)
  for (let i = 0; i < n; i++) els[i] = document.createElement("div")
  return els
}

const cubic = cubicBezier(0.4, 0, 0.2, 1)

for (const n of [100, 500]) {
  describe(`waapi fastpath: ${n} animations (fresh def per play)`, () => {
    const elsFast = makeElements(n)
    const elsDense = makeElements(n)
    bench("linearizable (2 keyframes, CSS cubic-bezier)", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(
          tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000, easing: cubic }),
          elsFast[i]!,
        )
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
    bench("dense sampling (quadratic easeOut)", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(
          tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000, easing: easeOut }),
          elsDense[i]!,
        )
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
  })

  describe(`waapi fastpath: ${n} animations (shared def across targets)`, () => {
    const elsFast = makeElements(n)
    const elsDense = makeElements(n)
    const fastDef = tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000, easing: cubic })
    const denseDef = tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000, easing: easeOut })
    bench("linearizable, shared def (planWaapi cache hit)", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(fastDef, elsFast[i]!)
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
    bench("dense sampling, shared def (planWaapi cache hit)", () => {
      const cs = new Array(n)
      for (let i = 0; i < n; i++) {
        cs[i] = play(denseDef, elsDense[i]!)
      }
      for (let i = 0; i < n; i++) {
        cs[i].finished.catch(() => {})
        cs[i].cancel()
      }
    })
  })
}
