/**
 * WAAPI rendering backend. Converts an `AnimationDef` into native
 * `Element.animate()` calls by sampling the animation at a fixed rate
 * and emitting a keyframes array.
 *
 * Because values already include the animation's easing at each
 * sample, WAAPI's own timing function is always `"linear"` — this
 * keeps the browser honest and supports arbitrary easings (springs,
 * custom functions) uniformly. Fewer samples work fine for linear /
 * cubic-bezier easings; a router may pre-detect those to emit a
 * two-keyframe animation with a CSS easing string, but that's an
 * optimization layered on top.
 *
 * Transform pseudo props (x, y, scale, rotate, …) compose into a
 * single `transform` keyframe per sample in a canonical order.
 */

import { getCssEasing } from "../core/easing"
import { type LazyPromise, createLazyPromise } from "../core/lazy-promise"
import type { AnimationDef } from "../core/types"
import type { FrameScheduler } from "../scheduler/frame"
import { pseudoToTransformFn } from "./properties"

export interface WaapiAnimation {
  pause(): void
  play(): void
  cancel(): void
  finish(): void
  reverse(): void
  // Native `Animation.currentTime` is `CSSNumberish | null`. We only assign
  // numbers to this field; the broader type keeps real DOM elements
  // assignable to the minimal `Animatable` surface.
  // Native `Animation.currentTime` is `CSSNumberish | null`, and
  // `onfinish` / `oncancel` carry a typed `AnimationPlaybackEvent`.
  // We deliberately relax these fields so `HTMLElement.animate()` return
  // values satisfy this minimal interface. Core only ever writes numbers
  // to `currentTime` and zero-arg callbacks to the event handlers.
  currentTime: unknown
  playbackRate: number
  readonly finished: Promise<unknown>
  onfinish: unknown
  oncancel: unknown
}

export interface Animatable {
  animate(
    keyframes: Keyframe[],
    options: { duration: number; easing: string; fill?: "forwards" | "none" | "both" },
  ): WaapiAnimation
}

export interface Keyframe {
  offset?: number
  transform?: string
  [key: string]: string | number | undefined
}

export type WaapiState = "idle" | "playing" | "paused" | "finished" | "cancelled"

export interface WaapiHandle {
  pause(): void
  resume(): void
  seek(progress: number): void
  reverse(): void
  setSpeed(multiplier: number): void
  cancel(): void
  readonly state: WaapiState
  readonly progress: number
  readonly direction: 1 | -1
  readonly finished: Promise<void>
}

export interface WaapiOpts {
  /**
   * Sample density in samples per millisecond. Default 1/16 (~60hz).
   * Higher values produce smoother keyframes at the cost of memory.
   */
  readonly sampleRateHz?: number
  /** Minimum total samples regardless of duration. Default 5. */
  readonly minSamples?: number
  /** Maximum total samples regardless of duration. Default 300. */
  readonly maxSamples?: number
  /** Fill mode for the WAAPI animation. Default `"forwards"`. */
  readonly fill?: "forwards" | "none" | "both"
}

/** Default unit tags applied to numeric pseudo transform values. */
const PSEUDO_UNIT: Record<string, string> = {
  translateX: "px",
  translateY: "px",
  translateZ: "px",
  rotate: "deg",
  rotateX: "deg",
  rotateY: "deg",
  rotateZ: "deg",
  skew: "deg",
  skewX: "deg",
  skewY: "deg",
  scale: "",
  scaleX: "",
  scaleY: "",
  scaleZ: "",
}

const TRANSFORM_ORDER: readonly string[] = [
  "translateX",
  "translateY",
  "translateZ",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
  "skew",
  "skewX",
  "skewY",
]

function formatPseudo(fn: string, value: unknown): string {
  if (typeof value === "string") return `${fn}(${value})`
  const unit = PSEUDO_UNIT[fn] ?? ""
  return `${fn}(${String(value)}${unit})`
}

function sampleCount(duration: number, opts: WaapiOpts): number {
  const rate = opts.sampleRateHz ?? 1 / 16
  const min = opts.minSamples ?? 5
  const max = opts.maxSamples ?? 300
  const n = Math.ceil(duration * rate) + 1
  return Math.max(min, Math.min(max, n))
}

/**
 * Build the WAAPI keyframes array from an AnimationDef. Separated from
 * the `animate` call so tests can verify the conversion without a DOM.
 */
export function buildKeyframes(
  def: AnimationDef<Readonly<Record<string, unknown>>>,
  opts: WaapiOpts = {},
): Keyframe[] {
  const n = sampleCount(def.duration, opts)
  const frames: Keyframe[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : i / (n - 1)
    const values = def.interpolate(offset)
    frames[i] = toKeyframe(values, offset)
  }
  return frames
}

interface WaapiPlan {
  readonly frames: Keyframe[]
  readonly easing: string
}

// Common real-world pattern: one AnimationDef shared across many targets
// (`const def = tween(...); els.forEach(el => play(def, el))`). Each play
// goes through planWaapi and used to re-sample the same def to the same
// keyframes from scratch. Cache per def so only the first play does the
// work; the rest share the keyframes array (which WAAPI's `animate()`
// treats as read-only input).
//
// Only cache when opts use the defaults that affect sampleCount. Callers
// that override sampleRateHz / minSamples / maxSamples would need a
// second-level key; they're rare enough that bypassing the cache is the
// right trade.
const planCache = new WeakMap<AnimationDef<Readonly<Record<string, unknown>>>, WaapiPlan>()

function hasDefaultSamplingOpts(opts: WaapiOpts): boolean {
  return (
    opts.sampleRateHz === undefined &&
    opts.minSamples === undefined &&
    opts.maxSamples === undefined
  )
}

function planWaapiUncached(
  def: AnimationDef<Readonly<Record<string, unknown>>>,
  opts: WaapiOpts,
): WaapiPlan {
  const cssEasing = def.linearizable ? getCssEasing(def.easing) : undefined
  if (cssEasing !== undefined) {
    return {
      frames: [toKeyframe(def.interpolate(0), 0), toKeyframe(def.interpolate(1), 1)],
      easing: cssEasing,
    }
  }
  return { frames: buildKeyframes(def, opts), easing: "linear" }
}

function planWaapi(
  def: AnimationDef<Readonly<Record<string, unknown>>>,
  opts: WaapiOpts,
): WaapiPlan {
  if (!hasDefaultSamplingOpts(opts)) return planWaapiUncached(def, opts)
  const cached = planCache.get(def)
  if (cached !== undefined) return cached
  const plan = planWaapiUncached(def, opts)
  planCache.set(def, plan)
  return plan
}

function toKeyframe(values: Readonly<Record<string, unknown>>, offset: number): Keyframe {
  const out: Keyframe = { offset }
  // Common case (opacity, transform, filter, etc.) never hits the pseudo
  // branch, so defer allocating the parts bag until we see the first
  // pseudo key. This saves two objects per keyframe per sample.
  let pseudo: Record<string, unknown> | null = null
  let explicitTransform: string | null = null

  for (const key in values) {
    const value = values[key]
    if (value === undefined) continue
    if (key === "transform" && typeof value === "string") {
      explicitTransform = value
      continue
    }
    const fn = pseudoToTransformFn(key)
    if (fn !== null) {
      if (pseudo === null) pseudo = {}
      pseudo[fn] = value
      continue
    }
    // Only compositor-safe and pseudo props reach this function (main-
    // tier props route to rAF). Compositor keys are already in the
    // camelCase shape WAAPI wants, so skip the classify/kebab round-trip.
    out[key] = value as string | number
  }

  if (pseudo !== null) {
    const parts: string[] = []
    for (const fn of TRANSFORM_ORDER) {
      if (fn in pseudo) {
        const value = pseudo[fn]
        if (value !== undefined) parts.push(formatPseudo(fn, value))
      }
    }
    out.transform = parts.join(" ")
  } else if (explicitTransform !== null) {
    out.transform = explicitTransform
  }

  return out
}

// Class-based handle. The nine public methods + three getters live on
// the prototype once instead of being allocated as fresh closures per
// play, and the two per-animation event handlers share a single bound
// pair across all targets. At n=1000 plays that's ~12,000 fewer closure
// allocations per bench cycle.
//
// Supports both eager and lazy setup. The lazy path defers the
// `Element.animate()` calls to the next scheduler tick so a cancel()
// before the tick fires skips WAAPI setup entirely. Control-plane
// calls made before setup update state directly or enqueue a replay
// op that fires once the animations exist. This used to live in a
// separate `LazyHandleImpl` wrapper class in strategy.ts, but the
// wrapper only ever wrapped `playWaapi`, so it collapsed into here:
// one handle per play instead of two, one LazyPromise instead of two.
class WaapiImpl implements WaapiHandle {
  readonly #duration: number
  readonly #lp: LazyPromise
  // Null until setup runs. Lazy path sets this in `#runSetup`; eager
  // path sets it in the constructor.
  #animations: readonly WaapiAnimation[] | null = null
  #state: WaapiState = "playing"
  #direction: 1 | -1 = 1
  #speed = 1
  #remaining = 0
  // Lazy-path: ops that came in before setup fired. Lazy-alloc; most
  // plays get no control-plane calls before the first tick.
  #pending: Array<(impl: WaapiImpl) => void> | null = null

  constructor(
    duration: number,
    animations: readonly WaapiAnimation[] | null,
    setup: (() => readonly WaapiAnimation[]) | null,
    scheduler: FrameScheduler | null,
  ) {
    this.#duration = duration
    this.#lp = createLazyPromise()
    if (animations !== null) {
      this.#installAnimations(animations)
      return
    }
    // Lazy path. One-shot schedule: cheaper than keepalive (plain array
    // push vs linked-list + Map insert). `cancel()` before the tick
    // fires can't extract the entry from the queue; instead it sets
    // `#state = "cancelled"` and `#runSetup` short-circuits on drain.
    // Tried routing this through a keepalive registration (so
    // `cancel()` could call `scheduler.cancel()` for immediate removal)
    // and measured a ~3x regression on cancel-before-first at n=1000
    // in exchange for preventing queue bloat in backgrounded tabs
    // (a non-goal for foreground perf). Stay on the one-shot path.
    ;(scheduler as FrameScheduler).schedule("update", this.#runSetup.bind(this, setup as () => readonly WaapiAnimation[]))
  }

  #runSetup(setup: () => readonly WaapiAnimation[]): void {
    if (this.#state === "cancelled") return
    this.#installAnimations(setup())
    const pending = this.#pending
    if (pending !== null) {
      for (const op of pending) op(this)
      this.#pending = null
    }
  }

  #installAnimations(animations: readonly WaapiAnimation[]): void {
    this.#animations = animations
    this.#remaining = animations.length
    if (this.#remaining === 0) {
      if (this.#state === "playing") {
        this.#state = "finished"
        this.#lp.resolve()
      }
      return
    }
    // Bind once, assign N times. `.bind()` allocates a function object
    // per call, so two binds total per play regardless of target count.
    const onFinish = this.#onAnimationFinish.bind(this)
    const onCancel = this.#onAnimationCancel.bind(this)
    for (let i = 0; i < animations.length; i++) {
      const a = animations[i] as WaapiAnimation
      a.onfinish = onFinish
      a.oncancel = onCancel
    }
    // Reflect any pre-setup state changes. `reverse` / `setSpeed` before
    // the first tick mutate `#direction` / `#speed`; apply the combined
    // rate here so animations start on the right direction/speed.
    const rate = this.#direction * this.#speed
    if (rate !== 1) {
      for (const a of animations) a.playbackRate = rate
    }
    if (this.#state === "paused") {
      for (const a of animations) a.pause()
    }
  }

  #queue(op: (impl: WaapiImpl) => void): void {
    if (this.#pending === null) this.#pending = [op]
    else this.#pending.push(op)
  }

  #onAnimationFinish(): void {
    this.#remaining--
    if (this.#remaining === 0 && this.#state === "playing") {
      this.#state = "finished"
      this.#lp.resolve()
    }
  }

  #onAnimationCancel(): void {
    if (this.#state === "playing" || this.#state === "paused") {
      this.#state = "cancelled"
      this.#lp.rejectCancelled()
    }
  }

  #syncPlaybackRate(): void {
    const animations = this.#animations
    if (animations === null) return
    const rate = this.#direction * this.#speed
    for (const a of animations) a.playbackRate = rate
  }

  pause(): void {
    if (this.#state !== "playing") return
    this.#state = "paused"
    const animations = this.#animations
    if (animations !== null) {
      for (const a of animations) a.pause()
    }
    // If pre-setup, `#installAnimations` will apply the paused state.
  }

  resume(): void {
    if (this.#state !== "paused") return
    this.#state = "playing"
    const animations = this.#animations
    if (animations !== null) {
      for (const a of animations) a.play()
    }
  }

  seek(p: number): void {
    if (this.#state === "cancelled") return
    const animations = this.#animations
    if (animations === null) {
      this.#queue(queuedSeek(p))
      return
    }
    const clamped = p < 0 ? 0 : p > 1 ? 1 : p
    const t = clamped * this.#duration
    for (const a of animations) a.currentTime = t
    if (this.#state === "finished") {
      this.#state = "playing"
      this.#remaining = animations.length
      for (const a of animations) a.play()
    }
  }

  reverse(): void {
    if (this.#state === "cancelled") return
    this.#direction = (this.#direction === 1 ? -1 : 1) as 1 | -1
    const animations = this.#animations
    if (animations === null) return
    this.#syncPlaybackRate()
    if (this.#state === "finished") {
      // WAAPI resumes automatically when we flip playbackRate from
      // a finished state at currentTime=duration, playing back to 0.
      this.#state = "playing"
      this.#remaining = animations.length
      for (const a of animations) a.play()
    }
  }

  setSpeed(multiplier: number): void {
    if (this.#state === "cancelled") return
    if (!(multiplier > 0)) {
      throw new Error(`setSpeed(): multiplier must be > 0 (got ${multiplier})`)
    }
    this.#speed = multiplier
    this.#syncPlaybackRate()
  }

  cancel(): void {
    if (this.#state === "finished" || this.#state === "cancelled") return
    this.#state = "cancelled"
    const animations = this.#animations
    if (animations !== null) {
      for (const a of animations) a.cancel()
    }
    // Pre-setup path: `#runSetup` sees `#state === "cancelled"` and
    // skips the entire `Element.animate()` loop. No animations were
    // created, so there's nothing to cancel on the DOM side.
    this.#lp.rejectCancelled()
  }

  get state(): WaapiState {
    return this.#state
  }

  get progress(): number {
    // Pre-setup: no animations yet, so nothing is on-screen. Report 0.
    // WAAPI's currentTime is compositor-driven, so we read the first
    // animation's currentTime rather than tracking a mirrored value.
    // All sibling animations share the same clock by construction
    // (same start, same playbackRate), so reading the first is fine.
    const animations = this.#animations
    if (animations === null || animations.length === 0) return 0
    const t = (animations[0] as WaapiAnimation).currentTime
    if (typeof t !== "number") return 0
    const p = t / this.#duration
    return p <= 0 ? 0 : p >= 1 ? 1 : p
  }

  get direction(): 1 | -1 {
    return this.#direction
  }

  get finished(): Promise<void> {
    return this.#lp.promise
  }
}

// Seek ops carry a number, so we can't share a module-level arrow the
// way pure-dispatch ops (pause/resume/reverse) could. Wrapping keeps
// the closure local and small: a fresh one per pre-setup `seek()` call
// in the rare case the caller seeks before the first tick.
const queuedSeek = (p: number) => (impl: WaapiImpl): void => impl.seek(p)

/**
 * Play a pre-computed WAAPI animation against the given targets.
 *
 * When `scheduler` is supplied, the `Element.animate()` calls are
 * deferred to the next scheduler tick, and `cancel()` before that tick
 * short-circuits the WAAPI setup entirely (no keyframes built, no DOM
 * writes, no native compositor negotiation). Omit `scheduler` to do
 * setup synchronously.
 */
export function playWaapi(
  def: AnimationDef<Readonly<Record<string, unknown>>>,
  targets: readonly Animatable[],
  opts: WaapiOpts = {},
  scheduler: FrameScheduler | null = null,
): WaapiHandle {
  if (!(def.duration > 0) || !Number.isFinite(def.duration)) {
    throw new Error(`playWaapi(): animation duration must be finite and > 0 (got ${def.duration})`)
  }
  if (scheduler === null) {
    return new WaapiImpl(def.duration, buildAnimations(def, targets, opts), null, null)
  }
  // Lazy path: the WaapiImpl schedules `setup()` for the next update
  // tick. Capturing def/targets/opts in the closure is unavoidable,
  // but there's only one such closure per play instead of the previous
  // two-layer wrapper.
  const setup = (): readonly WaapiAnimation[] => buildAnimations(def, targets, opts)
  return new WaapiImpl(def.duration, null, setup, scheduler)
}

function buildAnimations(
  def: AnimationDef<Readonly<Record<string, unknown>>>,
  targets: readonly Animatable[],
  opts: WaapiOpts,
): readonly WaapiAnimation[] {
  const { frames, easing: waapiEasing } = planWaapi(def, opts)
  const fill = opts.fill ?? "forwards"
  // Build the animations array inline (no `.map()` callback allocation)
  // so we don't pay for an extra closure on the hot path.
  const animations: WaapiAnimation[] = new Array(targets.length)
  const animateOpts = { duration: def.duration, easing: waapiEasing, fill }
  for (let i = 0; i < targets.length; i++) {
    animations[i] = (targets[i] as Animatable).animate(frames, animateOpts)
  }
  return animations
}
