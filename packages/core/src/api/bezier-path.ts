import { isSpringEasing, linear } from "../core/easing"
import { KinemError } from "../core/errors"
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

/**
 * Per-frame value emitted by `bezierPath`, `motionPath`, `arc`, and
 * `catmullRom`. `x` and `y` are always present; `rotate` is populated
 * only when the call was opted in via `{ rotateAlongPath: true }` and
 * is `undefined` otherwise. Consumers that don't ask for rotation can
 * ignore the field entirely. it won't be present at runtime, so
 * destructuring `{ x, y }` works with no unused-property warning.
 */
export interface BezierPathValue {
  readonly x: number
  readonly y: number
  readonly rotate?: number
}

/**
 * Generic de Casteljau evaluation for a Bézier of arbitrary degree.
 * Kept as a public export for use cases that want to evaluate a Bézier
 * directly without going through `bezierPath()`. Internally `bezierPath`
 * uses closed-form cubic math instead, since every segment is normalized
 * to a cubic at construction.
 */
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

function partitionPoints(points: readonly Point2[]): Point2[][] {
  if (points.length === 2 || points.length === 3 || points.length === 4) {
    return [[...points]]
  }
  if ((points.length - 1) % 3 !== 0) {
    throw new KinemError(
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

/**
 * Degree-elevate a 2-point (linear) or 3-point (quadratic) segment to
 * an equivalent 4-point cubic. The resulting cubic traces the exact
 * same curve, so callers that mix linear/quadratic/cubic inputs all go
 * through one closed-form evaluator.
 */
function elevateToCubic(seg: readonly Point2[]): [Point2, Point2, Point2, Point2] {
  if (seg.length === 4) {
    return [seg[0] as Point2, seg[1] as Point2, seg[2] as Point2, seg[3] as Point2]
  }
  if (seg.length === 3) {
    const p0 = seg[0] as Point2
    const q = seg[1] as Point2
    const p2 = seg[2] as Point2
    return [
      p0,
      [p0[0] + (2 * (q[0] - p0[0])) / 3, p0[1] + (2 * (q[1] - p0[1])) / 3],
      [p2[0] + (2 * (q[0] - p2[0])) / 3, p2[1] + (2 * (q[1] - p2[1])) / 3],
      p2,
    ]
  }
  // Linear: insert two points at thirds along the segment.
  const p0 = seg[0] as Point2
  const p1 = seg[1] as Point2
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  return [
    p0,
    [p0[0] + dx / 3, p0[1] + dy / 3],
    [p0[0] + (2 * dx) / 3, p0[1] + (2 * dy) / 3],
    p1,
  ]
}

interface CubicEval {
  /** segCount * 8 floats laid out as (x0,y0,x1,y1,x2,y2,x3,y3) per segment. */
  readonly cps: Float64Array
  /** segCount + 1 floats; cumulative[segCount] is the total arc length. */
  readonly cumulative: Float64Array
  /** segCount * (samplesPerSegment + 1) floats: arc length at each sample. */
  readonly sampleS: Float64Array
  /** Parallel array to sampleS, holding the matching parameter t. */
  readonly sampleT: Float64Array
  readonly samplesPerSegment: number
  readonly segmentCount: number
  readonly total: number
}

function buildCubicEval(points: readonly Point2[], samplesPerSegment: number): CubicEval {
  if (points.length < 2) {
    throw new KinemError("bezierPath: need at least 2 points")
  }
  const partitions = partitionPoints(points)
  const segCount = partitions.length
  const stride = samplesPerSegment + 1

  const cps = new Float64Array(segCount * 8)
  const cumulative = new Float64Array(segCount + 1)
  const sampleS = new Float64Array(segCount * stride)
  const sampleT = new Float64Array(segCount * stride)

  let cumLen = 0
  for (let s = 0; s < segCount; s++) {
    const cubic = elevateToCubic(partitions[s] as Point2[])
    const base = s * 8
    cps[base] = cubic[0][0]
    cps[base + 1] = cubic[0][1]
    cps[base + 2] = cubic[1][0]
    cps[base + 3] = cubic[1][1]
    cps[base + 4] = cubic[2][0]
    cps[base + 5] = cubic[2][1]
    cps[base + 6] = cubic[3][0]
    cps[base + 7] = cubic[3][1]

    cumulative[s] = cumLen

    const sampleBase = s * stride
    sampleS[sampleBase] = 0
    sampleT[sampleBase] = 0
    const x0 = cps[base] as number
    const y0 = cps[base + 1] as number
    const x1 = cps[base + 2] as number
    const y1 = cps[base + 3] as number
    const x2 = cps[base + 4] as number
    const y2 = cps[base + 5] as number
    const x3 = cps[base + 6] as number
    const y3 = cps[base + 7] as number
    let lastX = x0
    let lastY = y0
    let arc = 0
    for (let i = 1; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment
      const omt = 1 - t
      const a = omt * omt * omt
      const b = 3 * omt * omt * t
      const c = 3 * omt * t * t
      const d = t * t * t
      const px = a * x0 + b * x1 + c * x2 + d * x3
      const py = a * y0 + b * y1 + c * y2 + d * y3
      arc += Math.hypot(px - lastX, py - lastY)
      sampleS[sampleBase + i] = arc
      sampleT[sampleBase + i] = t
      lastX = px
      lastY = py
    }
    cumLen += arc
  }
  cumulative[segCount] = cumLen

  return {
    cps,
    cumulative,
    sampleS,
    sampleT,
    samplesPerSegment,
    segmentCount: segCount,
    total: cumLen,
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
  return buildCubicEval(points, samplesPerSegment).total
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
  if (samples < 2) throw new KinemError("sampleBezierPath: need at least 2 samples")
  const ev = buildCubicEval(points, samplesPerSegment)
  const out: Point2[] = new Array(samples)
  const tmp = new Float64Array(4)
  for (let i = 0; i < samples; i++) {
    evalAt(ev, i / (samples - 1), tmp)
    out[i] = [tmp[0] as number, tmp[1] as number]
  }
  return out
}

/**
 * Evaluate the cubic at progress p (0..1) along the whole path. Writes
 * four scalars into the supplied output: x, y, segIdx, t. The segIdx
 * and t fields let callers (the rotate-along-path variant) compute the
 * tangent without redoing the binary searches.
 */
function evalAt(ev: CubicEval, p: number, out: Float64Array): void {
  const { cps, cumulative, sampleS, sampleT, samplesPerSegment, segmentCount, total } = ev
  const stride = samplesPerSegment + 1

  if (segmentCount === 0 || total === 0 || p <= 0) {
    out[0] = cps[0] as number
    out[1] = cps[1] as number
    out[2] = 0
    out[3] = 0
    return
  }
  if (p >= 1) {
    const lastIdx = segmentCount - 1
    const last = lastIdx * 8
    out[0] = cps[last + 6] as number
    out[1] = cps[last + 7] as number
    out[2] = lastIdx
    out[3] = 1
    return
  }

  const targetS = p * total
  // Binary search for the segment whose cumulative range contains targetS.
  let lo = 0
  let hi = segmentCount
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((cumulative[mid] as number) <= targetS) lo = mid
    else hi = mid
  }
  const segIdx = lo
  const segBase = segIdx * 8
  const segArc = (cumulative[segIdx + 1] as number) - (cumulative[segIdx] as number)

  let t: number
  if (segArc === 0) {
    t = 0
  } else {
    const localS = targetS - (cumulative[segIdx] as number)
    const sampleBase = segIdx * stride
    let sLo = 0
    let sHi = samplesPerSegment
    while (sHi - sLo > 1) {
      const mid = (sLo + sHi) >> 1
      if ((sampleS[sampleBase + mid] as number) <= localS) sLo = mid
      else sHi = mid
    }
    const sa = sampleS[sampleBase + sLo] as number
    const sb = sampleS[sampleBase + sHi] as number
    const ta = sampleT[sampleBase + sLo] as number
    const tb = sampleT[sampleBase + sHi] as number
    const span = sb - sa
    t = span === 0 ? ta : ta + (tb - ta) * ((localS - sa) / span)
  }

  const omt = 1 - t
  const a = omt * omt * omt
  const b = 3 * omt * omt * t
  const c = 3 * omt * t * t
  const d = t * t * t
  const x0 = cps[segBase] as number
  const y0 = cps[segBase + 1] as number
  const x1 = cps[segBase + 2] as number
  const y1 = cps[segBase + 3] as number
  const x2 = cps[segBase + 4] as number
  const y2 = cps[segBase + 5] as number
  const x3 = cps[segBase + 6] as number
  const y3 = cps[segBase + 7] as number
  out[0] = a * x0 + b * x1 + c * x2 + d * x3
  out[1] = a * y0 + b * y1 + c * y2 + d * y3
  out[2] = segIdx
  out[3] = t
}

/**
 * Closed-form cubic-Bézier tangent angle in degrees, given the segment's
 * 8 control-point scalars (laid out x0,y0,x1,y1,x2,y2,x3,y3) and the
 * local parameter t.
 */
function cubicTangentDegrees(cps: Float64Array, base: number, t: number): number {
  const omt = 1 - t
  const x0 = cps[base] as number
  const y0 = cps[base + 1] as number
  const x1 = cps[base + 2] as number
  const y1 = cps[base + 3] as number
  const x2 = cps[base + 4] as number
  const y2 = cps[base + 5] as number
  const x3 = cps[base + 6] as number
  const y3 = cps[base + 7] as number
  const dx =
    3 * omt * omt * (x1 - x0) + 6 * omt * t * (x2 - x1) + 3 * t * t * (x3 - x2)
  const dy =
    3 * omt * omt * (y1 - y0) + 6 * omt * t * (y2 - y1) + 3 * t * t * (y3 - y2)
  return (Math.atan2(dy, dx) * 180) / Math.PI
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
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)
  const rotate = opts.rotateAlongPath === true
  const samplesPerSegment = opts.samplesPerSegment ?? DEFAULT_SAMPLES

  const ev = buildCubicEval(points, samplesPerSegment)
  const properties: readonly string[] = rotate ? ["x", "y", "rotate"] : ["x", "y"]
  const tierSplit = partitionByTier(properties)

  // Reused per-frame to receive (x, y, segIdx, t) from evalAt without
  // a fresh allocation. The final returned object is a fresh literal so
  // the consumer-visible contract (a new value each frame) is preserved.
  const tmp = new Float64Array(4)

  if (rotate) {
    return {
      duration,
      easing,
      interpolate: (p) => {
        evalAt(ev, easing(clamp01(p)), tmp)
        return {
          x: tmp[0] as number,
          y: tmp[1] as number,
          rotate: cubicTangentDegrees(ev.cps, (tmp[2] as number) * 8, tmp[3] as number),
        }
      },
      properties,
      tierSplit,
    }
  }

  return {
    duration,
    easing,
    interpolate: (p) => {
      evalAt(ev, easing(clamp01(p)), tmp)
      return { x: tmp[0] as number, y: tmp[1] as number }
    },
    properties,
    tierSplit,
  }
}
