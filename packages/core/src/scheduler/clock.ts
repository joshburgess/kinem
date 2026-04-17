/**
 * Monotonic time source for the scheduler. Produces virtual time that
 * advances with real time while active, pauses on demand, and can be
 * scaled via `setSpeed` for slow-motion / fast-forward debugging.
 *
 * The clock is a *value*, not a global: callers can construct their own
 * (e.g. a mock clock in tests) and pass it wherever a `Clock` is expected.
 * A shared process-wide default is exposed as `defaultClock`.
 */

export type NowFn = () => number

export interface Clock {
  /** Current virtual time in milliseconds. Monotonically non-decreasing. */
  now(): number
  pause(): void
  resume(): void
  readonly paused: boolean
  /**
   * Set the speed multiplier. `1` is real-time, `0.5` is half speed,
   * `2` is double speed. Values <= 0 are rejected; pass 0 via `pause()`.
   */
  setSpeed(multiplier: number): void
  readonly speed: number
  /** Reset virtual time back to zero without pausing. */
  reset(): void
}

export interface ClockOpts {
  /** Real-time source. Defaults to `performance.now` (or `Date.now`). */
  readonly now?: NowFn
  /** Initial speed multiplier. Defaults to 1. */
  readonly speed?: number
}

const realNow: NowFn = (() => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return () => performance.now()
  }
  return () => Date.now()
})()

export function createClock(opts: ClockOpts = {}): Clock {
  const nowFn = opts.now ?? realNow
  let speed = opts.speed ?? 1
  if (!(speed > 0)) {
    throw new Error(`createClock(): speed must be > 0 (got ${speed}); use pause() to halt`)
  }

  // Virtual time accrues from an anchor expressed in real time.
  // Invariant while running: virtual = (real - anchorReal) * speed + anchorVirtual.
  let anchorReal = nowFn()
  let anchorVirtual = 0
  let paused = false

  const flush = (): void => {
    const real = nowFn()
    anchorVirtual += (real - anchorReal) * speed
    anchorReal = real
  }

  return {
    now() {
      if (paused) return anchorVirtual
      return anchorVirtual + (nowFn() - anchorReal) * speed
    },
    pause() {
      if (paused) return
      flush()
      paused = true
    },
    resume() {
      if (!paused) return
      anchorReal = nowFn()
      paused = false
    },
    get paused() {
      return paused
    },
    setSpeed(multiplier: number) {
      if (!(multiplier > 0)) {
        throw new Error(`setSpeed(): multiplier must be > 0 (got ${multiplier})`)
      }
      if (!paused) flush()
      speed = multiplier
    },
    get speed() {
      return speed
    },
    reset() {
      anchorReal = nowFn()
      anchorVirtual = 0
    },
  }
}

/** Shared default clock for production use. Tests should create their own. */
export const defaultClock: Clock = createClock()
