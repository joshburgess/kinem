// @vitest-environment happy-dom

import {
  type ElementShim,
  type RafLike,
  createClock,
  createFrameScheduler,
  playRaf,
  tween,
} from "@kinem/core"
import { JSAnimation } from "motion-dom"
import { bench, describe } from "vitest"

/**
 * Steady-state per-tick cost: once N animations are running, how much
 * work does each frame take?
 *
 * We force both libraries onto their JS animators (main-thread) so the
 * comparison is fair. Kinem always uses its rAF backend here; motion
 * uses the `JSAnimation` class from `motion-dom`, which is the same
 * primitive motion composes into its `animate()` API when WAAPI is not
 * used.
 *
 * Both harnesses commit a single numeric property per frame into a
 * CSS custom property on a real happy-dom element. The commit cost is
 * shared across libs so the delta is the tick logic itself (progress
 * calculation, easing/generator evaluation, keyframe interpolation).
 *
 * Warning: motion's `JSAnimation` uses its own internal keyframe
 * generator and driver. We pass a no-op driver so the bench controls
 * the clock directly (via `.tick(t)`). Kinem is driven by a virtual
 * scheduler flushed with `scheduler.flushSync(t)`.
 */

interface ManualDriver {
  start: (keepAlive?: boolean) => void
  stop: () => void
  now: () => number
}

// Motion's JSAnimation accepts a `driver` factory. We give it a no-op
// driver that never calls `update` on its own. We'll drive the animation
// by calling `.tick(t)` manually from the bench body.
function makeManualDriver(nowRef: { value: number }): () => ManualDriver {
  return () => ({
    start: () => {},
    stop: () => {},
    now: () => nowRef.value,
  })
}

function makeTarget(): HTMLElement {
  return document.createElement("div")
}

function motifScene(n: number) {
  let now = 0
  const raf: RafLike = { request: () => 0, cancel: () => {} }
  const scheduler = createFrameScheduler({ raf, now: () => now })
  const clock = createClock({ now: () => now })
  for (let i = 0; i < n; i++) {
    const el = makeTarget() as unknown as ElementShim
    playRaf(tween({ x: [0, 100 + i] }, { duration: 1000 }), [el], {
      scheduler,
      clock,
      repeat: true,
    })
  }
  return {
    tick(dt: number) {
      now += dt
      scheduler.flushSync(now)
    },
  }
}

function motionScene(n: number) {
  const nowRef = { value: 0 }
  const driverFactory = makeManualDriver(nowRef)
  const animations: JSAnimation<number>[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const el = makeTarget()
    animations[i] = new JSAnimation<number>({
      keyframes: [0, 100 + i],
      duration: 1000,
      repeat: Number.POSITIVE_INFINITY,
      driver: driverFactory,
      onUpdate: (v) => {
        el.style.setProperty("--x", String(v))
      },
    })
  }
  // Seed startTime on every animation. Motion uses null->timestamp on
  // first tick, so we prime each one at t=0 before we start measuring.
  for (let i = 0; i < n; i++) animations[i]!.tick(0)
  return {
    tick(dt: number) {
      nowRef.value += dt
      const t = nowRef.value
      for (let i = 0; i < n; i++) animations[i]!.tick(t)
    },
  }
}

for (const n of [100, 500, 1000]) {
  describe(`steady-state tick (JS animator): ${n} animations per frame`, () => {
    const kinem = motifScene(n)
    const motion = motionScene(n)
    // Warm-up tick so the first sample hits steady state.
    kinem.tick(16)
    motion.tick(16)
    bench("kinem: playRaf — scheduler.flushSync(t)", () => {
      kinem.tick(16)
    })
    bench("motion: JSAnimation.tick(t) per animation", () => {
      motion.tick(16)
    })
  })
}
