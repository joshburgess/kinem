import { animation } from "../core/animation"
import { getCssEasing, isSpringEasing, linear } from "../core/easing"
import type { AnimationDef, EasingFn } from "../core/types"
import { interpolate } from "../interpolate/registry"

/**
 * Widen literal types to their base type so that `[0, 100]` produces a
 * `number` value (not `0 | 100`). This lets tween animations compose in
 * `sequence`/`parallel` even when their from/to literals differ.
 */
type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T

export type TweenProps = Record<string, readonly unknown[]>

/**
 * The value type of a tween animation: for each property, the widened
 * element type of its `[from, to]` pair.
 */
export type TweenValue<P extends TweenProps> = {
  [K in keyof P]: P[K] extends readonly (infer V)[] ? Widen<V> : never
}

export interface TweenOpts {
  /**
   * Animation duration in ms. If omitted and `easing` carries its own
   * duration (a spring easing), that duration is used. Otherwise defaults
   * to 400ms.
   */
  readonly duration?: number
  readonly easing?: EasingFn
}

const DEFAULT_DURATION = 400

/**
 * Construct a multi-property tween. Each entry in `props` is a
 * `[from, to]` tuple; the interpolation registry selects the right
 * interpolator per property.
 *
 * ```ts
 * tween({ opacity: [0, 1], x: [0, 100] }, { duration: 500, easing: easeOut })
 * ```
 */
export function tween<P extends TweenProps>(
  props: P,
  opts: TweenOpts = {},
): AnimationDef<TweenValue<P>> {
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)

  const keys = Object.keys(props) as Array<keyof P & string>
  const perPropFns: Array<(p: number) => unknown> = new Array(keys.length)
  let allPlainNumbers = true
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string
    const pair = props[key] as readonly unknown[]
    if (pair.length !== 2) {
      throw new Error(
        `tween(): property "${key}" must be a [from, to] pair (got length ${pair.length}); use keyframes() for more than two stops`,
      )
    }
    perPropFns[i] = interpolate(pair[0], pair[1])
    if (typeof pair[0] !== "number" || typeof pair[1] !== "number") {
      allPlainNumbers = false
    }
  }

  const def = animation(
    (progress) => {
      const out: Record<string, unknown> = {}
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as string
        out[key] = (perPropFns[i] as (p: number) => unknown)(progress)
      }
      return out as TweenValue<P>
    },
    duration,
    easing,
  )

  // Mark the tween as linearizable when every property is a plain
  // number-to-number interpolation AND the easing has a CSS timing-
  // function equivalent. The WAAPI backend uses this to emit a
  // 2-keyframe animation with native CSS timing, skipping dense
  // sampling.
  if (allPlainNumbers && getCssEasing(easing) !== undefined) {
    return { ...def, linearizable: true }
  }
  return def
}
