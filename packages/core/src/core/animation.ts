import { linear } from "./easing"
import { KinemError } from "./errors"
import type { AnimationDef, EasingFn, ParallelValues, StaggerFrom, StaggerOpts } from "./types"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

/**
 * Construct a leaf AnimationDef from a raw interpolator, duration, and easing.
 * The returned `interpolate` applies clamping and the easing function before
 * calling the user-supplied interpolator.
 */
export function animation<T>(
  interpolate: (progress: number) => T,
  duration: number,
  easing: EasingFn = linear,
): AnimationDef<T> {
  return {
    duration,
    easing,
    interpolate: (p) => interpolate(easing(clamp01(p))),
  }
}

/**
 * Play a list of animations one after another. Total duration is the sum of
 * the children's durations. Heterogeneous value types are not supported;
 * use `parallel` or `map` if you need a different shape.
 */
export function sequence<T>(...anims: AnimationDef<T>[]): AnimationDef<T> {
  if (anims.length === 0) {
    throw new KinemError("sequence() requires at least one animation")
  }
  if (anims.length === 1) return anims[0] as AnimationDef<T>

  const offsets: number[] = []
  let total = 0
  for (const a of anims) {
    offsets.push(total)
    total += a.duration
  }

  return {
    duration: total,
    easing: linear,
    interpolate: (p) => {
      const clamped = clamp01(p)
      if (total === 0) {
        const last = anims[anims.length - 1] as AnimationDef<T>
        return last.interpolate(1)
      }
      const t = clamped * total

      let idx = anims.length - 1
      for (let i = 0; i < anims.length - 1; i++) {
        if ((offsets[i + 1] ?? 0) > t) {
          idx = i
          break
        }
      }
      const child = anims[idx] as AnimationDef<T>
      const childT = t - (offsets[idx] ?? 0)
      const childP = child.duration === 0 ? 1 : childT / child.duration
      return child.interpolate(childP)
    },
  }
}

/**
 * Play a list of animations simultaneously. Total duration is the max of the
 * children's durations. Each child is evaluated at its own clamped progress,
 * so shorter children hold their final value once they complete.
 *
 * Value type is a tuple corresponding to the input animations.
 */
export function parallel<T extends readonly AnimationDef<unknown>[]>(
  ...anims: T
): AnimationDef<ParallelValues<T>> {
  if (anims.length === 0) {
    throw new KinemError("parallel() requires at least one animation")
  }
  let maxDur = 0
  for (const a of anims) if (a.duration > maxDur) maxDur = a.duration

  return {
    duration: maxDur,
    easing: linear,
    interpolate: (p) => {
      const clamped = clamp01(p)
      const t = maxDur === 0 ? 0 : clamped * maxDur
      const out = new Array(anims.length)
      for (let i = 0; i < anims.length; i++) {
        const child = anims[i] as AnimationDef<unknown>
        const childP = child.duration === 0 ? 1 : Math.min(1, t / child.duration)
        out[i] = child.interpolate(childP)
      }
      return out as unknown as ParallelValues<T>
    },
  }
}

const staggerDelay = (i: number, count: number, from: StaggerFrom): number => {
  if (typeof from === "function") return from(i, count)
  switch (from) {
    case "start":
      return i
    case "end":
      return count - 1 - i
    case "center": {
      const mid = (count - 1) / 2
      return Math.abs(i - mid)
    }
    case "edges": {
      const mid = (count - 1) / 2
      return mid - Math.min(i, count - 1 - i)
    }
    default:
      return Math.abs(i - from)
  }
}

/**
 * Spread `anim` across `count` elements with `each` ms between successive
 * starts. Returns an animation whose value is a readonly array of per-element
 * values; index 0 corresponds to element 0.
 *
 * `from` selects the stagger origin: "start" (default), "end", "center",
 * "edges", or a numeric index to stagger outward from.
 */
export function stagger<T>(anim: AnimationDef<T>, opts: StaggerOpts): AnimationDef<readonly T[]> {
  const { each, count } = opts
  const from: StaggerFrom = opts.from ?? "start"

  if (count < 1) throw new RangeError("stagger(): count must be >= 1")

  const raw = new Float64Array(count)
  let minOrder = Number.POSITIVE_INFINITY
  let maxOrder = Number.NEGATIVE_INFINITY
  for (let i = 0; i < count; i++) {
    const v = staggerDelay(i, count, from)
    raw[i] = v
    if (v < minOrder) minOrder = v
    if (v > maxOrder) maxOrder = v
  }

  const delays = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    delays[i] = ((raw[i] as number) - minOrder) * each
  }
  const maxDelay = (maxOrder - minOrder) * each

  const total = maxDelay + anim.duration

  return {
    duration: total,
    easing: linear,
    interpolate: (p) => {
      const clamped = clamp01(p)
      const t = total === 0 ? 0 : clamped * total
      const out = new Array<T>(count)
      for (let i = 0; i < count; i++) {
        const delay = delays[i] ?? 0
        const childT = t - delay
        const childP =
          anim.duration === 0
            ? childT >= 0
              ? 1
              : 0
            : Math.max(0, Math.min(1, childT / anim.duration))
        out[i] = anim.interpolate(childP)
      }
      return out
    },
  }
}

/**
 * Repeat an animation `count` times. Total duration multiplies accordingly.
 * Infinite repetition is not supported at this layer: loop `count` must be a
 * positive finite integer.
 */
export function loop<T>(anim: AnimationDef<T>, count = 1): AnimationDef<T> {
  if (!Number.isFinite(count) || count < 1) {
    throw new RangeError("loop(): count must be a finite number >= 1")
  }
  if (count === 1) return anim

  const total = anim.duration * count

  return {
    duration: total,
    easing: linear,
    interpolate: (p) => {
      const clamped = clamp01(p)
      if (clamped >= 1) return anim.interpolate(1)
      const cycleFloat = clamped * count
      const fraction = cycleFloat - Math.floor(cycleFloat)
      return anim.interpolate(fraction)
    },
  }
}

/** Prefix the animation with `ms` milliseconds of holding the start value. */
export function delay<T>(anim: AnimationDef<T>, ms: number): AnimationDef<T> {
  if (ms < 0) throw new RangeError("delay(): ms must be >= 0")
  if (ms === 0) return anim

  const total = anim.duration + ms

  return {
    duration: total,
    easing: linear,
    interpolate: (p) => {
      const clamped = clamp01(p)
      const t = clamped * total
      if (t <= ms) return anim.interpolate(0)
      if (anim.duration === 0) return anim.interpolate(1)
      return anim.interpolate((t - ms) / anim.duration)
    },
  }
}

/** Play an animation backwards. Duration is preserved. */
export function reverse<T>(anim: AnimationDef<T>): AnimationDef<T> {
  return {
    duration: anim.duration,
    easing: linear,
    interpolate: (p) => anim.interpolate(1 - clamp01(p)),
  }
}

/** Transform the value of an animation via a pure function. Timing is preserved. */
export function map<A, B>(anim: AnimationDef<A>, fn: (a: A) => B): AnimationDef<B> {
  return {
    duration: anim.duration,
    ...(anim.easing !== undefined ? { easing: anim.easing } : {}),
    interpolate: (p) => fn(anim.interpolate(p)),
  }
}
