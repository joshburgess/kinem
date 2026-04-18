import { getCssEasing, isSpringEasing, linear } from "../core/easing"
import type { AnimationDef, EasingFn } from "../core/types"
import { interpolate } from "../interpolate/registry"
import { partitionByTier } from "../render/properties"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

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

  // Build the def literal in one shot with `properties` + pre-computed
  // `tierSplit` so the strategy router can skip both `discoverProperties`
  // and `partitionByTier` on first play. `linearizable` is set when
  // every property is a plain number-to-number interpolation AND the
  // easing has a CSS timing-function equivalent; the WAAPI backend uses
  // this to emit a 2-keyframe animation with native CSS timing.
  const properties = keys as readonly string[]
  const tierSplit = partitionByTier(properties)
  const linearizable = allPlainNumbers && getCssEasing(easing) !== undefined

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
      return out as TweenValue<P>
    },
    properties,
    tierSplit,
    linearizable,
  }
}
