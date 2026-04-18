/**
 * Monotonic time source for the scheduler. Produces virtual time that
 * advances with real time while active, pauses on demand, and can be
 * scaled via `setSpeed` for slow-motion / fast-forward debugging.
 *
 * The clock is a *value*, not a global: callers can construct their own
 * (e.g. a mock clock in tests) and pass it wherever a `Clock` is expected.
 * A shared process-wide default is exposed as `defaultClock`.
 *
 * Implemented as a class so the public methods live on the prototype
 * once rather than being reallocated as closures per clock. Every
 * `createTiming` constructs a fresh clock when the caller doesn't supply
 * one, so at n=1000 plays that's 6000 fewer closure allocs per cycle.
 */

export type NowFn = () => number

export interface Clock {
  /** Current virtual time in milliseconds. Monotonically non-decreasing. */
  now(): number
  /**
   * Same semantics as `now()`, but uses the caller-supplied real-time
   * timestamp instead of calling the internal `nowFn` again. Lets the
   * rAF-driven Timing reuse the scheduler's frame time and avoid a
   * redundant `performance.now()` per tick per animation.
   */
  nowAt(realTime: number): number
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

class ClockImpl implements Clock {
  readonly #nowFn: NowFn
  #speed: number
  // Virtual time accrues from an anchor expressed in real time.
  // Invariant while running: virtual = (real - anchorReal) * speed + anchorVirtual.
  #anchorReal: number
  #anchorVirtual = 0
  #paused = false

  constructor(opts: ClockOpts) {
    const speed = opts.speed ?? 1
    if (!(speed > 0)) {
      throw new Error(`createClock(): speed must be > 0 (got ${speed}); use pause() to halt`)
    }
    this.#nowFn = opts.now ?? realNow
    this.#speed = speed
    this.#anchorReal = this.#nowFn()
  }

  #flush(): void {
    const real = this.#nowFn()
    this.#anchorVirtual += (real - this.#anchorReal) * this.#speed
    this.#anchorReal = real
  }

  now(): number {
    if (this.#paused) return this.#anchorVirtual
    return this.#anchorVirtual + (this.#nowFn() - this.#anchorReal) * this.#speed
  }

  nowAt(realTime: number): number {
    if (this.#paused) return this.#anchorVirtual
    return this.#anchorVirtual + (realTime - this.#anchorReal) * this.#speed
  }

  pause(): void {
    if (this.#paused) return
    this.#flush()
    this.#paused = true
  }

  resume(): void {
    if (!this.#paused) return
    this.#anchorReal = this.#nowFn()
    this.#paused = false
  }

  get paused(): boolean {
    return this.#paused
  }

  setSpeed(multiplier: number): void {
    if (!(multiplier > 0)) {
      throw new Error(`setSpeed(): multiplier must be > 0 (got ${multiplier})`)
    }
    if (!this.#paused) this.#flush()
    this.#speed = multiplier
  }

  get speed(): number {
    return this.#speed
  }

  reset(): void {
    this.#anchorReal = this.#nowFn()
    this.#anchorVirtual = 0
  }
}

export function createClock(opts: ClockOpts = {}): Clock {
  return new ClockImpl(opts)
}

/** Shared default clock for production use. Tests should create their own. */
export const defaultClock: Clock = createClock()
