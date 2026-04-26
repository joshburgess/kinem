import { KinemError } from "../core/errors"
import type { AnimationDef } from "../core/types"
import { type BezierPathOpts, type BezierPathValue, type Point2, bezierPath } from "./bezier-path"

export interface CatmullRomOpts extends BezierPathOpts {
  /**
   * Curve "looseness". 0 = full Catmull-Rom (smoothest), 1 = straight
   * lines through the waypoints. Defaults to 0.
   */
  readonly tension?: number
  /**
   * When true, the curve loops back to the first waypoint with smooth
   * tangents at the join.
   */
  readonly closed?: boolean
}

/**
 * Convert Catmull-Rom waypoints to a flat list of cubic-Bézier control
 * points (1 + 3N pattern). The resulting curve passes through every
 * waypoint with C¹ continuity.
 */
export function catmullRomToCubicPoints(
  waypoints: readonly Point2[],
  tension: number,
  closed: boolean,
): Point2[] {
  const n = waypoints.length
  if (n < 2) throw new KinemError("catmullRom: need at least 2 waypoints")

  const get = (i: number): Point2 => {
    if (closed) return waypoints[((i % n) + n) % n] as Point2
    if (i < 0) return waypoints[0] as Point2
    if (i >= n) return waypoints[n - 1] as Point2
    return waypoints[i] as Point2
  }

  const k = (1 - tension) / 6
  const out: Point2[] = [get(0)]
  const segCount = closed ? n : n - 1

  for (let i = 0; i < segCount; i++) {
    const pPrev = get(i - 1)
    const p0 = get(i)
    const p1 = get(i + 1)
    const pNext = get(i + 2)

    out.push(
      [p0[0] + (p1[0] - pPrev[0]) * k, p0[1] + (p1[1] - pPrev[1]) * k],
      [p1[0] - (pNext[0] - p0[0]) * k, p1[1] - (pNext[1] - p0[1]) * k],
      [p1[0], p1[1]],
    )
  }

  return out
}

/**
 * Animate `{x, y}` (and optional `rotate`) along a Catmull-Rom spline
 * that passes through every waypoint. This is the "I want to draw a
 * smooth curve through these points" primitive.
 *
 * ```ts
 * play(
 *   catmullRom(
 *     [
 *       [50, 200],
 *       [200, 80],
 *       [350, 240],
 *       [500, 120],
 *       [650, 200],
 *     ],
 *     { duration: 2400, tension: 0, rotateAlongPath: true },
 *   ),
 *   plane,
 * )
 * ```
 */
export function catmullRom(
  waypoints: readonly Point2[],
  opts: CatmullRomOpts = {},
): AnimationDef<BezierPathValue> {
  const points = catmullRomToCubicPoints(waypoints, opts.tension ?? 0, opts.closed === true)
  return bezierPath(points, opts)
}
