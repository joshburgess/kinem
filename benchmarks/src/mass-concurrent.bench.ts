import {
  type ElementShim,
  type RafLike,
  createClock,
  createFrameScheduler,
  easeOut,
  playRaf,
  tween,
} from "kinem"
import { bench, describe } from "vitest"

/**
 * Stress test: N concurrent animations sharing one frame scheduler,
 * driven through a full `playRaf` pipeline (progress + interpolate +
 * commit). Unlike `mass-interpolation`, this includes the per-tick
 * scheduler overhead and the commit write to a target, which is the
 * realistic hot path for a busy scene. Virtual clock + no-op rAF keeps
 * the measurement deterministic and CI-safe. `repeat: true` prevents
 * the animations from finishing mid-bench and turning into no-op ticks.
 */

function makeTarget(): ElementShim {
  const styles = new Map<string, string>()
  return {
    style: {
      setProperty(name, value) {
        styles.set(name, value)
      },
    },
    setAttribute() {},
  }
}

function makeScene(n: number) {
  let now = 0
  const raf: RafLike = {
    request: () => 0,
    cancel: () => {},
  }
  const scheduler = createFrameScheduler({ raf, now: () => now })
  const clock = createClock({ now: () => now })
  const handles: Array<{ cancel: () => void; finished: Promise<void> }> = new Array(n)
  for (let i = 0; i < n; i++) {
    const t = makeTarget()
    handles[i] = playRaf(
      tween(
        {
          x: [`${0}px`, `${100 + i}px`],
          y: [`${0}px`, `${i * 2}px`],
          opacity: ["0", "1"],
        },
        { duration: 1000, easing: easeOut },
      ),
      [t],
      { scheduler, clock, repeat: true },
    )
  }
  return {
    tick(dt: number) {
      now += dt
      scheduler.flushSync(now)
    },
    cancel() {
      for (const h of handles) {
        // Catch the cancellation rejection so it doesn't leak to the
        // benchmark runner as an unhandled rejection.
        h.finished.catch(() => {})
        h.cancel()
      }
    },
  }
}

for (const n of [100, 500, 1000]) {
  describe(`mass concurrent: ${n} animations per frame`, () => {
    const scene = makeScene(n)
    // Warm-up tick so the first bench sample hits steady state.
    scene.tick(16)
    bench(`frame tick (all ${n} commit)`, () => {
      scene.tick(16)
    })
  })
}

describe("mass concurrent: startup cost", () => {
  bench("spin up 1000 playRaf handles", () => {
    const scene = makeScene(1000)
    scene.cancel()
  })
})
