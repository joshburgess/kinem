import { KinemError } from "../core/errors"
import type { AnimationDef } from "../core/types"
import { parsePath } from "../interpolate/path"
import {
  type BezierPathOpts,
  type BezierPathValue,
  type Point2,
  bezierPath,
  bezierPathLength,
} from "./bezier-path"

/**
 * Convert an SVG path `d` string into a flat list of cubic-Bézier control
 * points (1 + 3N pattern) suitable for `bezierPath`. Lines and quadratics
 * are degree-elevated to cubics. Arc commands ('A') and multi-subpath
 * paths ('M' after the first) are not yet supported.
 */
export function svgPathToCubicPoints(d: string): readonly Point2[] {
  const cmds = parsePath(d)
  const out: Point2[] = []
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let prevCtrl: Point2 | null = null
  let prevType = ""

  const lineToCubic = (toX: number, toY: number): void => {
    out.push(
      [cx + (toX - cx) / 3, cy + (toY - cy) / 3],
      [cx + (2 * (toX - cx)) / 3, cy + (2 * (toY - cy)) / 3],
      [toX, toY],
    )
  }
  const quadToCubic = (qx: number, qy: number, toX: number, toY: number): void => {
    out.push(
      [cx + (2 * (qx - cx)) / 3, cy + (2 * (qy - cy)) / 3],
      [toX + (2 * (qx - toX)) / 3, toY + (2 * (qy - toY)) / 3],
      [toX, toY],
    )
  }

  for (const cmd of cmds) {
    const T = cmd.type.toUpperCase()
    const rel = cmd.type !== T
    const p = cmd.params
    const ax = (i: number): number => (rel ? cx : 0) + (p[i] ?? 0)
    const ay = (i: number): number => (rel ? cy : 0) + (p[i] ?? 0)

    switch (T) {
      case "M": {
        const x = ax(0)
        const y = ay(1)
        if (out.length === 0) {
          out.push([x, y])
        } else {
          throw new KinemError(
            "motionPath: multiple subpaths (additional 'M' commands) are not supported",
            "split the path into separate motionPath() calls or merge subpaths",
          )
        }
        cx = x
        cy = y
        startX = x
        startY = y
        prevCtrl = null
        break
      }
      case "L": {
        const x = ax(0)
        const y = ay(1)
        lineToCubic(x, y)
        cx = x
        cy = y
        prevCtrl = null
        break
      }
      case "H": {
        const x = ax(0)
        lineToCubic(x, cy)
        cx = x
        prevCtrl = null
        break
      }
      case "V": {
        const y = ay(0)
        lineToCubic(cx, y)
        cy = y
        prevCtrl = null
        break
      }
      case "C": {
        const c1: Point2 = [ax(0), ay(1)]
        const c2: Point2 = [ax(2), ay(3)]
        const x = ax(4)
        const y = ay(5)
        out.push(c1, c2, [x, y])
        cx = x
        cy = y
        prevCtrl = c2
        break
      }
      case "S": {
        const c2: Point2 = [ax(0), ay(1)]
        const x = ax(2)
        const y = ay(3)
        const c1: Point2 =
          prevCtrl && (prevType === "C" || prevType === "S")
            ? [2 * cx - prevCtrl[0], 2 * cy - prevCtrl[1]]
            : [cx, cy]
        out.push(c1, c2, [x, y])
        cx = x
        cy = y
        prevCtrl = c2
        break
      }
      case "Q": {
        const qx = ax(0)
        const qy = ay(1)
        const x = ax(2)
        const y = ay(3)
        quadToCubic(qx, qy, x, y)
        cx = x
        cy = y
        prevCtrl = [qx, qy]
        break
      }
      case "T": {
        const x = ax(0)
        const y = ay(1)
        const q: Point2 =
          prevCtrl && (prevType === "Q" || prevType === "T")
            ? [2 * cx - prevCtrl[0], 2 * cy - prevCtrl[1]]
            : [cx, cy]
        quadToCubic(q[0], q[1], x, y)
        cx = x
        cy = y
        prevCtrl = q
        break
      }
      case "Z": {
        lineToCubic(startX, startY)
        cx = startX
        cy = startY
        prevCtrl = null
        break
      }
      case "A":
        throw new KinemError(
          "motionPath: arc commands ('A') are not yet supported",
          "approximate arcs with cubic Bezier ('C') segments",
        )
      default:
        throw new KinemError(`motionPath: unknown command "${cmd.type}"`)
    }
    prevType = T
  }

  if (out.length < 2) {
    throw new KinemError(
      "motionPath: path produced no movable segments",
      "make sure the SVG path includes at least one drawing command after 'M'",
    )
  }
  return out
}

/**
 * Animate `{x, y}` along an SVG path string. Lines, cubic Béziers, and
 * quadratic Béziers (and their smooth `S`/`T` variants) are supported and
 * all converted to cubic segments under the hood. Arc commands ('A') and
 * multi-subpath paths are not.
 *
 * ```ts
 * play(
 *   motionPath("M 0 0 C 50 -100, 150 -100, 200 0 S 350 100, 400 0", {
 *     duration: 2000,
 *     rotateAlongPath: true,
 *   }),
 *   el,
 * )
 * ```
 */
export function motionPath(d: string, opts: BezierPathOpts = {}): AnimationDef<BezierPathValue> {
  return bezierPath(svgPathToCubicPoints(d), opts)
}

/**
 * Compute the arc length of an SVG path string. Mirrors
 * `SVGGeometryElement.getTotalLength()` but works without a DOM, using
 * the same cubic-Bézier sampling that drives `motionPath`. Pair with
 * `strokeDraw({ pathLength })` to draw a path on while a follower
 * animates along it at the same speed.
 */
export function svgPathLength(d: string, samplesPerSegment?: number): number {
  return bezierPathLength(svgPathToCubicPoints(d), samplesPerSegment)
}
