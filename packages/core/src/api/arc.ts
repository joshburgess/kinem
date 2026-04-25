import { isSpringEasing, linear } from "../core/easing"
import type { AnimationDef, EasingFn } from "../core/types"
import { partitionByTier } from "../render/properties"
import type { BezierPathValue } from "./bezier-path"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)
const DEFAULT_DURATION = 1000
const RAD = Math.PI / 180

export interface ArcOpts {
  readonly duration?: number
  readonly easing?: EasingFn
  /** When true, emit a tangent rotate (degrees) for orientation along the arc. */
  readonly rotateAlongPath?: boolean
}

/**
 * Animate `{x, y}` along an exact circular arc. Unlike Bézier
 * approximations, this is a true circle (no error from the cubic
 * approximation), which matters for clock hands, orbital motion, and
 * other geometry-perfect cases.
 *
 * Angles are in degrees, measured CCW from the positive x-axis (math
 * convention). For SVG/screen coordinates where y points down, a
 * positive angle delta sweeps clockwise visually.
 *
 * ```ts
 * arc(200, 200, 80, 0, 360, { duration: 4000 })
 * ```
 */
export function arc(
  cx: number,
  cy: number,
  radius: number,
  fromAngle: number,
  toAngle: number,
  opts: ArcOpts = {},
): AnimationDef<BezierPathValue> {
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)
  const rotate = opts.rotateAlongPath === true
  const fromR = fromAngle * RAD
  const toR = toAngle * RAD
  const properties: readonly string[] = rotate ? ["x", "y", "rotate"] : ["x", "y"]
  const tierSplit = partitionByTier(properties)

  return {
    duration,
    easing,
    interpolate: (p) => {
      const t = easing(clamp01(p))
      const a = fromR + (toR - fromR) * t
      const x = cx + radius * Math.cos(a)
      const y = cy + radius * Math.sin(a)
      if (rotate) {
        // Tangent direction: derivative of (cos a, sin a) is (-sin a, cos a)
        const dir = toR >= fromR ? 1 : -1
        const tan = (Math.atan2(dir * Math.cos(a), -dir * Math.sin(a)) * 180) / Math.PI
        return { x, y, rotate: tan }
      }
      return { x, y }
    },
    properties,
    tierSplit,
  }
}
