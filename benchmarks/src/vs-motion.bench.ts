// @vitest-environment happy-dom

import { interpolateNumber, play, tween } from "motif-animate"
import { animate } from "motion"
// motion-dom is installed transitively via `motion`. Its `mix()` is the
// primitive we compare against motif's `interpolateNumber()`. Deep import
// avoids forcing consumers to install an extra package just for benches.
import { mix } from "motion-dom"
import { bench, describe } from "vitest"

/**
 * End-to-end library-overhead comparison against Motion (framer-motion/dom).
 * Both libraries target the same synthetic HTMLElements in a happy-dom
 * environment. We measure the startup + teardown cycle because:
 *
 *   - once a WAAPI animation is running, the browser compositor drives
 *     it — the library is out of the hot path.
 *   - the per-element setup cost (parsing values, building keyframes,
 *     invoking `Element.animate`) is what a library actually contributes
 *     on a busy page.
 *
 * Everything else (rAF ticks, commit costs) is measured by the
 * mass-interpolation and mass-concurrent benches against motif internals.
 */

function makeElements(n: number): HTMLElement[] {
  const els = new Array<HTMLElement>(n)
  for (let i = 0; i < n; i++) els[i] = document.createElement("div")
  return els
}

describe("pure interpolation: number", () => {
  const motifFn = interpolateNumber(0, 100)
  const motionFn = mix(0, 100)
  bench("motif: interpolateNumber(0, 100)(p)", () => {
    motifFn(0.5)
  })
  bench("motion: mix(0, 100)(p)", () => {
    motionFn(0.5)
  })
})

for (const n of [10, 100, 500]) {
  describe(`start + cancel ${n} animations`, () => {
    const motifElsAuto = makeElements(n)
    const motifElsCoarse = makeElements(n)
    const motifElsRaf = makeElements(n)
    const motionEls = makeElements(n)
    bench("motif: play(tween) — default (waapi, dense)", () => {
      const controls = new Array(n)
      for (let i = 0; i < n; i++) {
        controls[i] = play(
          tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 }),
          motifElsAuto[i]!,
        )
      }
      for (let i = 0; i < n; i++) {
        controls[i].finished.catch(() => {})
        controls[i].cancel()
      }
    })
    bench("motif: play(tween) — coarse keyframes (maxSamples=2)", () => {
      const controls = new Array(n)
      for (let i = 0; i < n; i++) {
        controls[i] = play(
          tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 }),
          motifElsCoarse[i]!,
          { maxSamples: 2, minSamples: 2 },
        )
      }
      for (let i = 0; i < n; i++) {
        controls[i].finished.catch(() => {})
        controls[i].cancel()
      }
    })
    bench("motif: play(tween) — rAF backend", () => {
      const controls = new Array(n)
      for (let i = 0; i < n; i++) {
        controls[i] = play(
          tween({ x: [0, 100], opacity: [0, 1] }, { duration: 1000 }),
          motifElsRaf[i]!,
          { backend: "raf" },
        )
      }
      for (let i = 0; i < n; i++) {
        controls[i].finished.catch(() => {})
        controls[i].cancel()
      }
    })
    bench("motion: animate(...).stop()", () => {
      const controls = new Array(n)
      for (let i = 0; i < n; i++) {
        controls[i] = animate(motionEls[i]!, { x: 100, opacity: 1 }, { duration: 1 })
      }
      for (let i = 0; i < n; i++) controls[i].stop()
    })
  })
}
