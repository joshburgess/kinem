/**
 * Shared animation state machine used by both the DOM rAF backend and
 * non-DOM drivers (canvas, WebGL). Owns progress tracking, pause/
 * resume/seek/reverse/speed, and the finished promise. The caller
 * plugs in a `commit(values)` callback that does whatever rendering
 * the surface needs: applying DOM properties, drawing to a canvas, or
 * uploading a uniform.
 *
 * Implemented as a class so the public methods and most internal
 * helpers live on the prototype rather than being reallocated as
 * closures per play. Per instance we allocate just: the instance
 * itself, one arrow-field closure for the scheduler tick callback
 * (`#tick`, which needs per-instance identity for `scheduler.schedule`/
 * `cancel` pairing), a lazy promise, and a clock if one wasn't
 * supplied.
 *
 * A single tick runs in the scheduler's `update` phase and does both
 * progress computation and the `commit()` render. The 4-phase
 * scheduler separates `compute` from `update` to support systems that
 * need strict read-before-write ordering (e.g. DOM-reading then
 * DOM-writing animations that would otherwise layout-thrash). Our
 * compute side just samples clock time and runs the def's pure
 * interpolator; it never touches the DOM, so splitting it from update
 * would pay two scheduler ops per tick in exchange for a batching
 * opportunity we can't use. Halving the scheduler ops per play and
 * per steady-state frame is the real win.
 */

import { type LazyPromise, createLazyPromise } from "../core/lazy-promise"
import type { AnimationDef } from "../core/types"
import { type Clock, createClock } from "../scheduler/clock"
import { type FrameScheduler, frame as defaultFrame } from "../scheduler/frame"

export type TimingState = "idle" | "playing" | "paused" | "finished" | "cancelled"

export interface TimingHandle {
  pause(): void
  resume(): void
  /** Seek to `progress` in [0, 1]. Does not change play/pause state. */
  seek(progress: number): void
  /** Flip the playback direction. May resume a finished animation. */
  reverse(): void
  /** Set clock speed multiplier; must be > 0. */
  setSpeed(multiplier: number): void
  cancel(): void
  readonly state: TimingState
  readonly progress: number
  readonly direction: 1 | -1
  readonly finished: Promise<void>
}

export interface TimingOpts {
  readonly scheduler?: FrameScheduler
  readonly clock?: Clock
  readonly repeat?: boolean
  readonly onFinish?: () => void
}

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

class Timing<V> implements TimingHandle {
  readonly #scheduler: FrameScheduler
  readonly #clock: Clock
  readonly #def: AnimationDef<V>
  readonly #commit: (values: V) => void
  readonly #opts: TimingOpts
  readonly #duration: number
  readonly #lp: LazyPromise
  #state: TimingState = "playing"
  #direction: 1 | -1 = 1
  #anchorProgress = 0
  #anchorTime = 0
  #progress = 0
  #needsRender = true

  // Arrow field: the scheduler dedupes and cancels by function
  // reference, so a prototype method (shared across instances) would
  // collide. This closure is the only per-instance one.
  readonly #tick = (): void => {
    if (this.#state === "playing") {
      this.#progress = this.#computeProgress()
      this.#needsRender = true
      if (this.#isFinished(this.#progress)) {
        this.#progress = this.#direction === 1 ? 1 : 0
        this.#render()
        this.#needsRender = false
        this.#state = "finished"
        this.#disarm()
        this.#opts.onFinish?.()
        this.#lp.resolve()
        return
      }
    }
    if (this.#needsRender) {
      this.#render()
      this.#needsRender = false
      if (this.#state === "paused") this.#disarm()
    }
  }

  constructor(def: AnimationDef<V>, commit: (values: V) => void, opts: TimingOpts = {}) {
    const duration = def.duration
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new Error(`createTiming(): animation duration must be finite and > 0 (got ${duration})`)
    }
    this.#scheduler = opts.scheduler ?? defaultFrame
    this.#clock = opts.clock ?? createClock()
    this.#clock.reset()
    this.#def = def
    this.#commit = commit
    this.#opts = opts
    this.#duration = duration
    this.#lp = createLazyPromise()
    this.#armKeepalive()
  }

  #computeProgress(): number {
    const elapsed = (this.#clock.now() - this.#anchorTime) / this.#duration
    const raw = this.#anchorProgress + this.#direction * elapsed
    if (this.#opts.repeat) {
      return ((raw % 1) + 1) % 1
    }
    return clamp01(raw)
  }

  #render(): void {
    this.#commit(this.#def.interpolate(this.#progress))
  }

  #armKeepalive(): void {
    this.#scheduler.schedule("update", this.#tick, { keepalive: true })
  }

  #disarm(): void {
    this.#scheduler.cancel("update", this.#tick)
  }

  #isFinished(p: number): boolean {
    if (this.#opts.repeat) return false
    return (this.#direction === 1 && p >= 1) || (this.#direction === -1 && p <= 0)
  }

  #rebase(): void {
    this.#anchorProgress = this.#progress
    this.#anchorTime = this.#clock.now()
  }

  pause(): void {
    if (this.#state !== "playing") return
    this.#progress = this.#computeProgress()
    this.#clock.pause()
    this.#rebase()
    this.#state = "paused"
    this.#needsRender = true
  }

  resume(): void {
    if (this.#state !== "paused") return
    this.#clock.resume()
    this.#rebase()
    this.#state = "playing"
    this.#armKeepalive()
  }

  seek(p: number): void {
    if (this.#state === "cancelled") return
    const clamped = clamp01(p)
    this.#progress = clamped
    this.#rebase()
    this.#needsRender = true
    if (this.#state === "finished" && !this.#isFinished(clamped)) {
      this.#state = "playing"
      this.#armKeepalive()
    } else if (this.#state === "paused") {
      this.#scheduler.schedule("update", this.#tick)
    }
  }

  reverse(): void {
    if (this.#state === "cancelled") return
    this.#progress = this.#computeProgress()
    this.#rebase()
    this.#direction = (this.#direction === 1 ? -1 : 1) as 1 | -1
    this.#needsRender = true
    if (this.#state === "finished" && !this.#isFinished(this.#progress)) {
      this.#state = "playing"
      this.#armKeepalive()
    } else if (this.#state === "paused") {
      this.#scheduler.schedule("update", this.#tick)
    }
  }

  setSpeed(multiplier: number): void {
    if (this.#state === "cancelled") return
    if (this.#state === "playing") this.#progress = this.#computeProgress()
    this.#rebase()
    this.#clock.setSpeed(multiplier)
  }

  cancel(): void {
    if (this.#state === "finished" || this.#state === "cancelled") return
    this.#state = "cancelled"
    this.#disarm()
    this.#lp.reject(new Error("animation cancelled"))
  }

  get state(): TimingState {
    return this.#state
  }

  get progress(): number {
    return this.#progress
  }

  get direction(): 1 | -1 {
    return this.#direction
  }

  get finished(): Promise<void> {
    return this.#lp.promise
  }
}

/**
 * Build a `TimingHandle` that drives `def.interpolate(progress)` and
 * calls `commit(values)` whenever a new frame should be rendered.
 */
export function createTiming<V>(
  def: AnimationDef<V>,
  commit: (values: V) => void,
  opts: TimingOpts = {},
): TimingHandle {
  return new Timing(def, commit, opts)
}
