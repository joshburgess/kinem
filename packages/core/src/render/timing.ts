/**
 * Shared animation state machine used by both the DOM rAF backend and
 * non-DOM drivers (canvas, WebGL). Owns progress tracking, pause/
 * resume/seek/reverse/speed, and the finished promise. The caller
 * plugs in a `commit(values)` callback that does whatever rendering
 * the surface needs: applying DOM properties, drawing to a canvas, or
 * uploading a uniform.
 *
 * Implemented as a class so the public methods live on the prototype
 * rather than being reallocated as closures per play. The class also
 * directly implements `KeepaliveNode`, which lets it register into
 * the scheduler's keepalive list without allocating a wrapper node
 * or storing a `Map<fn, node>` entry. Per play, we allocate: the
 * Timing instance itself, a lazy promise, and a clock if one wasn't
 * supplied. No per-instance tick closure.
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
import {
  type FrameScheduler,
  type FrameState,
  type KeepaliveNode,
  type Phase,
  frame as defaultFrame,
} from "../scheduler/frame"

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

class Timing<V> implements TimingHandle, KeepaliveNode {
  readonly #scheduler: FrameScheduler
  // Lazy. `null` until first access if the caller didn't supply one.
  // `createClock()` costs an object alloc + a `performance.now()` call;
  // cancel-before-first never needs a clock, so we skip both there.
  #clock: Clock | null
  readonly #def: AnimationDef<V>
  readonly #commit: ((values: V) => void) | null
  // Direct-render path: called with the current progress instead of
  // with an interpolated values bag. When non-null, `#commit` is
  // bypassed and the def's `commit(p, el)` path owns rendering end-to-
  // end for every target. Set by `createTimingDirect`.
  readonly #directRender: ((progress: number) => void) | null
  readonly #opts: TimingOpts
  readonly #duration: number
  readonly #lp: LazyPromise
  #state: TimingState = "playing"
  #direction: 1 | -1 = 1
  #anchorProgress = 0
  #anchorTime = 0
  #progress = 0
  #needsRender = true

  // KeepaliveNode fields. Scheduler-owned; do not touch outside the
  // scheduler. Initialized so the scheduler sees a fresh node on
  // first registration.
  _kaPrev: KeepaliveNode | null = null
  _kaNext: KeepaliveNode | null = null
  _kaPhase: Phase | null = null
  _kaDead = false

  constructor(
    def: AnimationDef<V>,
    commit: ((values: V) => void) | null,
    directRender: ((progress: number) => void) | null,
    opts: TimingOpts = {},
  ) {
    const duration = def.duration
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new Error(`createTiming(): animation duration must be finite and > 0 (got ${duration})`)
    }
    this.#scheduler = opts.scheduler ?? defaultFrame
    // Accept a caller-supplied clock eagerly (tests use this). Otherwise
    // defer `createClock()` until first tick. No `.reset()` — a freshly
    // constructed clock is already anchored to the current moment.
    this.#clock = opts.clock ?? null
    this.#def = def
    this.#commit = commit
    this.#directRender = directRender
    this.#opts = opts
    this.#duration = duration
    this.#lp = createLazyPromise()
    this.#armKeepalive()
  }

  #ensureClock(): Clock {
    let c = this.#clock
    if (c === null) {
      c = createClock()
      this.#clock = c
    }
    return c
  }

  // Prototype method (shared across all Timing instances) — no per-
  // instance closure allocation. The scheduler walks the keepalive
  // list and calls `_kaTick(state)` on each node.
  _kaTick(state: FrameState): void {
    if (this.#state === "playing") {
      this.#progress = this.#computeProgress(state.time)
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

  // `realTime`, when provided, is the scheduler's frame timestamp
  // (same source as the clock's internal `nowFn`). Reusing it lets the
  // steady-state tick skip one `performance.now()` call per animation
  // per frame.
  #computeProgress(realTime?: number): number {
    const clock = this.#ensureClock()
    const now = realTime !== undefined ? clock.nowAt(realTime) : clock.now()
    const elapsed = (now - this.#anchorTime) / this.#duration
    const raw = this.#anchorProgress + this.#direction * elapsed
    if (this.#opts.repeat) {
      return ((raw % 1) + 1) % 1
    }
    return clamp01(raw)
  }

  #render(): void {
    if (this.#directRender !== null) {
      this.#directRender(this.#progress)
    } else {
      // `#commit` is always set when `#directRender` is null — the
      // factory functions enforce that invariant.
      ;(this.#commit as (v: V) => void)(this.#def.interpolate(this.#progress))
    }
  }

  #armKeepalive(): void {
    this.#scheduler.scheduleNode("update", this)
  }

  #disarm(): void {
    this.#scheduler.cancelNode(this)
  }

  // One-shot re-render scheduled after seek/reverse from a paused
  // state. Allocates an arrow closure (the fn-based one-shot API
  // takes a FrameJob); cold path, runs once per user-initiated
  // seek/reverse, so the alloc is fine.
  #scheduleOneShotTick(): void {
    this.#scheduler.schedule("update", (state) => this._kaTick(state))
  }

  #isFinished(p: number): boolean {
    if (this.#opts.repeat) return false
    return (this.#direction === 1 && p >= 1) || (this.#direction === -1 && p <= 0)
  }

  #rebase(): void {
    this.#anchorProgress = this.#progress
    this.#anchorTime = this.#ensureClock().now()
  }

  pause(): void {
    if (this.#state !== "playing") return
    this.#progress = this.#computeProgress()
    this.#ensureClock().pause()
    this.#rebase()
    this.#state = "paused"
    this.#needsRender = true
  }

  resume(): void {
    if (this.#state !== "paused") return
    this.#ensureClock().resume()
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
      this.#scheduleOneShotTick()
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
      this.#scheduleOneShotTick()
    }
  }

  setSpeed(multiplier: number): void {
    if (this.#state === "cancelled") return
    if (this.#state === "playing") this.#progress = this.#computeProgress()
    this.#rebase()
    this.#ensureClock().setSpeed(multiplier)
  }

  cancel(): void {
    if (this.#state === "finished" || this.#state === "cancelled") return
    this.#state = "cancelled"
    this.#disarm()
    this.#lp.rejectCancelled()
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
  return new Timing(def, commit, null, opts)
}

/**
 * Build a `TimingHandle` that invokes `render(progress)` directly on
 * every frame, skipping `def.interpolate()`. Used by backends that can
 * commit values straight to their target surface via `def.commit(p, el)`
 * (e.g. the rAF DOM path) without materializing a values bag.
 *
 * @internal
 */
export function createTimingDirect<V>(
  def: AnimationDef<V>,
  render: (progress: number) => void,
  opts: TimingOpts = {},
): TimingHandle {
  return new Timing(def, null, render, opts)
}
