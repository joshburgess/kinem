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
import { createLazyPromise } from "../core/lazy-promise"
import type { AnimationDef } from "../core/types"
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

export function playWaapi(
  def: AnimationDef<Readonly<Record<string, unknown>>>,
  targets: readonly Animatable[],
  opts: WaapiOpts = {},
): WaapiHandle {
  if (!(def.duration > 0) || !Number.isFinite(def.duration)) {
    throw new Error(`playWaapi(): animation duration must be finite and > 0 (got ${def.duration})`)
  }

  const { frames, easing: waapiEasing } = planWaapi(def, opts)
  const fill = opts.fill ?? "forwards"
  const animations = targets.map((t) =>
    t.animate(frames, { duration: def.duration, easing: waapiEasing, fill }),
  )

  let state: WaapiState = "playing"
  let direction: 1 | -1 = 1
  let speed = 1

  const lp = createLazyPromise()

  let remaining = animations.length
  if (remaining === 0) {
    state = "finished"
    lp.resolve()
  }

  const syncPlaybackRate = (): void => {
    for (const a of animations) a.playbackRate = direction * speed
  }

  for (const a of animations) {
    a.onfinish = () => {
      remaining--
      if (remaining === 0 && state === "playing") {
        state = "finished"
        lp.resolve()
      }
    }
    a.oncancel = () => {
      if (state === "playing" || state === "paused") {
        state = "cancelled"
        lp.rejectCancelled()
      }
    }
  }

  return {
    pause() {
      if (state !== "playing") return
      for (const a of animations) a.pause()
      state = "paused"
    },
    resume() {
      if (state !== "paused") return
      for (const a of animations) a.play()
      state = "playing"
    },
    seek(p: number) {
      if (state === "cancelled") return
      const clamped = p < 0 ? 0 : p > 1 ? 1 : p
      const t = clamped * def.duration
      for (const a of animations) a.currentTime = t
      if (state === "finished") {
        state = "playing"
        remaining = animations.length
        for (const a of animations) a.play()
      }
    },
    reverse() {
      if (state === "cancelled") return
      direction = (direction === 1 ? -1 : 1) as 1 | -1
      syncPlaybackRate()
      if (state === "finished") {
        // WAAPI resumes automatically when we flip playbackRate from
        // a finished state at currentTime=duration, playing back to 0.
        state = "playing"
        remaining = animations.length
        for (const a of animations) a.play()
      }
    },
    setSpeed(multiplier: number) {
      if (state === "cancelled") return
      if (!(multiplier > 0)) {
        throw new Error(`setSpeed(): multiplier must be > 0 (got ${multiplier})`)
      }
      speed = multiplier
      syncPlaybackRate()
    },
    cancel() {
      if (state === "finished" || state === "cancelled") return
      state = "cancelled"
      for (const a of animations) a.cancel()
      lp.rejectCancelled()
    },
    get state() {
      return state
    },
    get direction() {
      return direction
    },
    get finished() {
      return lp.promise
    },
  }
}
