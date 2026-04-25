/**
 * `inertia()` — exponential-decay momentum primitive.
 *
 * Where `tween` and `spring` interpolate from a known start to a known
 * end, `inertia` only knows the start and an initial velocity, and lets
 * the value glide to a self-determined rest point. This is the right
 * shape for flick/throw release motion (drag end, scroll fling) where
 * the user supplies a velocity and the library decides where to stop.
 *
 * ## Model
 *
 * Each property follows a power-decay trajectory:
 *
 *     value(t) = from + power * v0 * τ * (1 - exp(-t / τ))
 *
 * where `τ` (the time constant, `timeConstant` opt) is in seconds,
 * `v0` is the initial velocity in units per second, and `power` is a
 * unitless scale factor on the total displacement. The total
 * displacement (as t → ∞) is `power * v0 * τ`, so for an iOS-feel
 * default (`τ = 0.325`, `power = 0.8`), a 1000-unit/sec flick travels
 * 260 units before stopping.
 *
 * Per-property `bounds` clamp the output. The trajectory itself is not
 * reshaped — the value just stops moving once it hits the bound. (For
 * a "rubber-band" feel against a wall, compose with `spring` after
 * inertia settles.)
 *
 * Duration is derived from the slowest property: each property's
 * "settle time" is `τ * ln(|displacement| / restDelta)`, the def's
 * duration is the max across properties.
 */

import { linear } from "../core/easing"
import type { AnimationDef } from "../core/types"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

/**
 * Per-property input: `[from, velocity]`. Velocity is in units per second.
 */
export type InertiaProps = Readonly<Record<string, readonly [number, number]>>

export type InertiaValue<P extends InertiaProps> = {
  [K in keyof P]: number
}

export interface InertiaOpts {
  /**
   * Decay time constant in milliseconds. Larger = longer glide.
   * Default 325 (matches iOS scroll inertia).
   */
  readonly timeConstant?: number
  /**
   * Velocity multiplier applied uniformly to every property.
   * Total displacement = `power * v0 * (timeConstant / 1000)`. Default 0.8.
   */
  readonly power?: number
  /**
   * The animation stops once the remaining displacement falls below
   * this magnitude. Default 0.5.
   */
  readonly restDelta?: number
  /**
   * Per-property output clamps `[min, max]`. Properties without an
   * entry are unbounded.
   */
  readonly bounds?: Readonly<Record<string, readonly [number, number]>>
}

const DEFAULT_TC = 325
const DEFAULT_POWER = 0.8
const DEFAULT_REST_DELTA = 0.5

interface PerProp {
  readonly key: string
  readonly from: number
  readonly displacement: number
  readonly min: number
  readonly max: number
}

/**
 * Velocity-driven exponential-decay animation. One property:
 *
 * ```ts
 * play(inertia({ translateY: [currentY, releaseVy] }), el)
 * ```
 *
 * Multi-property (e.g. 2D throw):
 *
 * ```ts
 * play(inertia(
 *   { translateX: [x0, vx], translateY: [y0, vy] },
 *   { bounds: { translateX: [0, 600], translateY: [0, 400] } },
 * ), el)
 * ```
 */
export function inertia<P extends InertiaProps>(
  props: P,
  opts: InertiaOpts = {},
): AnimationDef<InertiaValue<P>> {
  const tcMs = opts.timeConstant ?? DEFAULT_TC
  const power = opts.power ?? DEFAULT_POWER
  const restDelta = opts.restDelta ?? DEFAULT_REST_DELTA
  const boundsMap = opts.bounds

  if (tcMs <= 0) throw new RangeError("inertia(): timeConstant must be > 0")
  if (restDelta <= 0) throw new RangeError("inertia(): restDelta must be > 0")

  const tcSec = tcMs / 1000
  const keys = Object.keys(props) as Array<keyof P & string>

  const perProp: PerProp[] = []
  let duration = 0
  for (const key of keys) {
    const pair = props[key] as readonly [number, number]
    const from = pair[0]
    const v0 = pair[1]
    const displacement = power * v0 * tcSec
    const bound = boundsMap?.[key]
    const min = bound ? bound[0] : Number.NEGATIVE_INFINITY
    const max = bound ? bound[1] : Number.POSITIVE_INFINITY

    perProp.push({ key, from, displacement, min, max })

    const absD = Math.abs(displacement)
    if (absD > restDelta) {
      const t = tcMs * Math.log(absD / restDelta)
      if (t > duration) duration = t
    }
  }

  const properties = keys as readonly string[]

  return {
    duration,
    easing: linear,
    interpolate: (p) => {
      const t = duration === 0 ? 0 : clamp01(p) * duration
      const decay = duration === 0 ? 1 : 1 - Math.exp(-t / tcMs)
      const out: Record<string, number> = {}
      for (let i = 0; i < perProp.length; i++) {
        const pp = perProp[i] as PerProp
        let v = pp.from + pp.displacement * decay
        if (v < pp.min) v = pp.min
        else if (v > pp.max) v = pp.max
        out[pp.key] = v
      }
      return out as InertiaValue<P>
    },
    properties,
  }
}
