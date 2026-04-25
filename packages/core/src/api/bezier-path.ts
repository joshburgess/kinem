import { isSpringEasing, linear } from "../core/easing"
import type { AnimationDef, EasingFn } from "../core/types"
import { partitionByTier } from "../render/properties"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

const DEFAULT_DURATION = 400
const DEFAULT_SAMPLES = 32

export type Point2 = readonly [number, number]

export interface BezierPathOpts {
  readonly duration?: number
  readonly easing?: EasingFn
  /**
   * When true, emit a `rotate` value (degrees) tangent to the curve so
   * elements can orient along the path.
   */
  readonly rotateAlongPath?: boolean
  /**
   * Samples per segment for arc-length parameterization. Higher = more
   * accurate constant-velocity motion, at construction-time cost. 32 is
   * usually fine; bump for high-curvature curves. Defaults to 32.
   */
  readonly samplesPerSegment?: number
}

export interface BezierPathValue {
  readonly x: number
  readonly y: number
  readonly rotate?: number
}

interface ArcSample {
  readonly s: number
  readonly t: number
}

interface Segment {
  readonly points: readonly Point2[]
  readonly cumulativeStart: number
  readonly arcLength: number
  readonly samples: readonly ArcSample[]
}

export function deCasteljau(points: readonly Point2[], t: number): Point2 {
  const n = points.length
  if (n === 2) {
    const a = points[0] as Point2
    const b = points[1] as Point2
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
  const xs = new Array<number>(n)
  const ys = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const p = points[i] as Point2
    xs[i] = p[0]
    ys[i] = p[1]
  }
  for (let r = n - 1; r > 0; r--) {
    for (let i = 0; i < r; i++) {
      xs[i] = (xs[i] as number) + ((xs[i + 1] as number) - (xs[i] as number)) * t
      ys[i] = (ys[i] as number) + ((ys[i + 1] as number) - (ys[i] as number)) * t
    }
  }
  return [xs[0] as number, ys[0] as number]
}

function bezierTangent(points: readonly Point2[], t: number): Point2 {
  const n = points.length - 1
  if (n <= 0) return [0, 0]
  const dpts: Point2[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = points[i] as Point2
    const b = points[i + 1] as Point2
    dpts[i] = [n * (b[0] - a[0]), n * (b[1] - a[1])]
  }
  return deCasteljau(dpts, t)
}

function partitionPoints(points: readonly Point2[]): Point2[][] {
  if (points.length === 2 || points.length === 3 || points.length === 4) {
    return [[...points]]
  }
  if ((points.length - 1) % 3 !== 0) {
    throw new Error(
      `bezierPath: with ${points.length} points expected 2 (linear), 3 (quadratic), 4 (cubic), or 1+3N points (chained cubics)`,
    )
  }
  const segs: Point2[][] = []
  for (let i = 0; i + 3 < points.length; i += 3) {
    segs.push([
      points[i] as Point2,
      points[i + 1] as Point2,
      points[i + 2] as Point2,
      points[i + 3] as Point2,
    ])
  }
  return segs
}

interface BuiltSegments {
  readonly segments: readonly Segment[]
  readonly total: number
}

export function buildBezierSegments(
  points: readonly Point2[],
  samplesPerSegment: number = DEFAULT_SAMPLES,
): BuiltSegments {
  if (points.length < 2) {
    throw new Error("bezierPath: need at least 2 points")
  }
  const partitions = partitionPoints(points)
  const segs: Segment[] = []
  let cumulative = 0
  for (const sp of partitions) {
    const samples: ArcSample[] = new Array(samplesPerSegment + 1)
    samples[0] = { s: 0, t: 0 }
    let last = sp[0] as Point2
    let arc = 0
    for (let i = 1; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment
      const pt = deCasteljau(sp, t)
      arc += Math.hypot(pt[0] - last[0], pt[1] - last[1])
      samples[i] = { s: arc, t }
      last = pt
    }
    segs.push({ points: sp, cumulativeStart: cumulative, arcLength: arc, samples })
    cumulative += arc
  }
  return { segments: segs, total: cumulative }
}

export function evaluateBezierAt(
  segments: readonly Segment[],
  totalLength: number,
  p: number,
): { readonly segIdx: number; readonly t: number } {
  if (segments.length === 0) return { segIdx: 0, t: p }
  if (totalLength === 0) return { segIdx: 0, t: 0 }
  if (p <= 0) return { segIdx: 0, t: 0 }
  if (p >= 1) {
    const lastIdx = segments.length - 1
    return { segIdx: lastIdx, t: 1 }
  }
  const targetS = p * totalLength
  let segIdx = segments.length - 1
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as Segment
    if (targetS <= seg.cumulativeStart + seg.arcLength) {
      segIdx = i
      break
    }
  }
  const seg = segments[segIdx] as Segment
  if (seg.arcLength === 0) return { segIdx, t: 0 }
  const localS = targetS - seg.cumulativeStart
  const samples = seg.samples
  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((samples[mid] as ArcSample).s <= localS) lo = mid
    else hi = mid
  }
  const a = samples[lo] as ArcSample
  const b = samples[hi] as ArcSample
  const span = b.s - a.s
  const localT = span === 0 ? a.t : a.t + (b.t - a.t) * ((localS - a.s) / span)
  return { segIdx, t: localT }
}

export function bezierPathFromSegments(
  segments: readonly Segment[],
  total: number,
  opts: BezierPathOpts = {},
): AnimationDef<BezierPathValue> {
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)
  const rotate = opts.rotateAlongPath === true

  const properties: readonly string[] = rotate ? ["x", "y", "rotate"] : ["x", "y"]
  const tierSplit = partitionByTier(properties)

  return {
    duration,
    easing,
    interpolate: (p) => {
      const eased = easing(clamp01(p))
      const { segIdx, t } = evaluateBezierAt(segments, total, eased)
      const seg = segments[segIdx] as Segment
      const pt = deCasteljau(seg.points, t)
      if (rotate) {
        const tan = bezierTangent(seg.points, t)
        return { x: pt[0], y: pt[1], rotate: (Math.atan2(tan[1], tan[0]) * 180) / Math.PI }
      }
      return { x: pt[0], y: pt[1] }
    },
    properties,
    tierSplit,
  }
}

/**
 * Compute the total arc length of a Bézier path defined by control
 * points (same shape `bezierPath` accepts). Useful for pairing motion
 * along a path with stroke-draw effects, since `strokeDraw` needs the
 * path's pathLength.
 */
export function bezierPathLength(
  points: readonly Point2[],
  samplesPerSegment: number = DEFAULT_SAMPLES,
): number {
  return buildBezierSegments(points, samplesPerSegment).total
}

/**
 * Sample N evenly-spaced (by arc length) points along a Bézier path.
 * Returns N points where index 0 is the start and index N-1 is the end.
 * Used by `morphPath` to blend two paths whose command structures don't
 * match.
 */
export function sampleBezierPath(
  points: readonly Point2[],
  samples: number,
  samplesPerSegment: number = DEFAULT_SAMPLES,
): Point2[] {
  if (samples < 2) throw new Error("sampleBezierPath: need at least 2 samples")
  const built = buildBezierSegments(points, samplesPerSegment)
  const out: Point2[] = new Array(samples)
  for (let i = 0; i < samples; i++) {
    const p = i / (samples - 1)
    const { segIdx, t } = evaluateBezierAt(built.segments, built.total, p)
    out[i] = deCasteljau((built.segments[segIdx] as Segment).points, t)
  }
  return out
}

/**
 * Animate `{x, y}` along a Bézier curve defined by control points.
 *
 * Point counts: 2 (linear), 3 (quadratic), 4 (cubic), or 1+3N (chained
 * cubics where each new cubic starts at the previous endpoint and adds
 * three new points). Matches SVG path `M ... C` convention.
 *
 * Motion is parameterized by arc length, so progress moves at constant
 * speed along the curve regardless of curvature. Set
 * `rotateAlongPath: true` to also receive a tangent angle in degrees.
 *
 * ```ts
 * play(
 *   bezierPath(
 *     [
 *       [0, 0],
 *       [50, -100],
 *       [150, -100],
 *       [200, 0],
 *     ],
 *     { duration: 1000, rotateAlongPath: true },
 *   ),
 *   el,
 * )
 * ```
 */
export function bezierPath(
  points: readonly Point2[],
  opts: BezierPathOpts = {},
): AnimationDef<BezierPathValue> {
  const { segments, total } = buildBezierSegments(points, opts.samplesPerSegment ?? DEFAULT_SAMPLES)
  return bezierPathFromSegments(segments, total, opts)
}
