import { isSpringEasing, linear } from "../core/easing"
import type { AnimationDef, EasingFn } from "../core/types"
import { partitionByTier } from "../render/properties"
import { type Point2, sampleBezierPath } from "./bezier-path"
import { svgPathToCubicPoints } from "./motion-path"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)
const DEFAULT_DURATION = 800
const DEFAULT_SAMPLES = 96

export interface MorphPathOpts {
  readonly duration?: number
  readonly easing?: EasingFn
  /**
   * Number of polyline samples used for the blend. Higher = smoother
   * morph at the cost of larger output strings. Defaults to 96.
   */
  readonly samples?: number
}

/**
 * Morph between two SVG path strings whose command structures may not
 * match. Each path is sampled to N evenly-spaced points along its arc
 * length, then the points are linearly interpolated to produce an
 * intermediate polyline.
 *
 * Unlike `interpolatePath` (which requires identical command sequences),
 * this works for arbitrary shape morphs (heart → star → circle).
 *
 * ```ts
 * play(morphPath(heartD, starD, { duration: 1200 }), pathEl)
 * ```
 */
export function morphPath(
  from: string,
  to: string,
  opts: MorphPathOpts = {},
): AnimationDef<{ d: string }> {
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)
  const n = opts.samples ?? DEFAULT_SAMPLES
  const a = sampleBezierPath(svgPathToCubicPoints(from), n)
  const b = sampleBezierPath(svgPathToCubicPoints(to), n)

  const properties: readonly string[] = ["d"]
  const tierSplit = partitionByTier(properties)

  const ax = new Float64Array(n)
  const ay = new Float64Array(n)
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const pa = a[i] as Point2
    const pb = b[i] as Point2
    ax[i] = pa[0]
    ay[i] = pa[1]
    dx[i] = pb[0] - pa[0]
    dy[i] = pb[1] - pa[1]
  }

  return {
    duration,
    easing,
    interpolate: (p) => {
      const t = easing(clamp01(p))
      let s = `M ${(ax[0] as number) + (dx[0] as number) * t} ${(ay[0] as number) + (dy[0] as number) * t}`
      for (let i = 1; i < n; i++) {
        s += ` L ${(ax[i] as number) + (dx[i] as number) * t} ${(ay[i] as number) + (dy[i] as number) * t}`
      }
      return { d: s }
    },
    properties,
    tierSplit,
  }
}
