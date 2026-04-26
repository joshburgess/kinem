import { isSpringEasing, linear } from "../core/easing"
import { KinemError } from "../core/errors"
import type { AnimationDef, EasingFn } from "../core/types"
import { interpolate } from "../interpolate/registry"
import { partitionByTier } from "../render/properties"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

export type KeyframeStops = Record<string, readonly unknown[]>

export type KeyframesValue<P extends KeyframeStops> = {
  [K in keyof P]: P[K] extends readonly (infer V)[] ? V : never
}

export interface KeyframesOpts {
  readonly duration?: number
  readonly easing?: EasingFn
  /**
   * Explicit offsets in [0, 1]. If provided, must have the same length as
   * each property's stop array. Defaults to even distribution per property.
   */
  readonly offsets?: readonly number[]
}

const DEFAULT_DURATION = 400

function evenOffsets(n: number): number[] {
  if (n < 2) return [0]
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = i / (n - 1)
  return out
}

function validateOffsets(offsets: readonly number[], n: number): void {
  if (offsets.length !== n) {
    throw new KinemError(
      `keyframes(): offsets length ${offsets.length} must match stops length ${n}`,
      "either omit `offsets` to use even spacing or provide one offset per stop",
    )
  }
  if (offsets[0] !== 0 || offsets[n - 1] !== 1) {
    throw new KinemError(
      "keyframes(): offsets must start at 0 and end at 1",
      "anchor the first stop at 0 and the last at 1",
    )
  }
  for (let i = 1; i < n; i++) {
    if ((offsets[i] ?? 0) < (offsets[i - 1] ?? 0)) {
      throw new KinemError(
        "keyframes(): offsets must be monotonically non-decreasing",
        "each subsequent offset must be >= the previous one",
      )
    }
  }
}

/**
 * Multi-stop animation. For each property, evaluate a piecewise-linear
 * interpolation between the provided stops. Defaults to even offset
 * distribution; a shared `offsets` array can override this.
 *
 * ```ts
 * keyframes(
 *   { y: [0, -50, 0, -25, 0], scale: [1, 1.1, 1, 1.05, 1] },
 *   { duration: 800, easing: easeOut },
 * )
 * ```
 */
export function keyframes<P extends KeyframeStops>(
  stops: P,
  opts: KeyframesOpts = {},
): AnimationDef<KeyframesValue<P>> {
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)

  const keys = Object.keys(stops) as Array<keyof P & string>
  const perPropFns: Array<(p: number) => unknown> = new Array(keys.length)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string
    const values = stops[key] as readonly unknown[]
    if (values.length < 2) {
      throw new KinemError(
        `keyframes(): property "${key}" needs at least two stops`,
        "use tween() for [from, to] pairs",
      )
    }
    const n = values.length
    const offsets = opts.offsets ?? evenOffsets(n)
    if (opts.offsets) validateOffsets(opts.offsets, n)

    const segments: Array<(p: number) => unknown> = new Array(n - 1)
    for (let j = 0; j < n - 1; j++) {
      segments[j] = interpolate(values[j], values[j + 1])
    }

    perPropFns[i] = (p) => {
      if (p <= 0) return values[0]
      if (p >= 1) return values[n - 1]
      let idx = n - 2
      for (let j = 0; j < n - 1; j++) {
        if ((offsets[j + 1] ?? 0) >= p) {
          idx = j
          break
        }
      }
      const start = offsets[idx] ?? 0
      const end = offsets[idx + 1] ?? 1
      const local = end === start ? 0 : (p - start) / (end - start)
      return (segments[idx] as (q: number) => unknown)(local)
    }
  }

  // Build the def literal directly with `properties` + pre-computed
  // `tierSplit` so the strategy router can skip both `discoverProperties`
  // and `partitionByTier` on first play.
  const properties = keys as readonly string[]
  const tierSplit = partitionByTier(properties)

  return {
    duration,
    easing,
    interpolate: (p) => {
      const eased = easing(clamp01(p))
      const out: Record<string, unknown> = {}
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as string
        out[key] = (perPropFns[i] as (q: number) => unknown)(eased)
      }
      return out as KeyframesValue<P>
    },
    properties,
    tierSplit,
  }
}
