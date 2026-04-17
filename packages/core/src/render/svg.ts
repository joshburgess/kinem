/**
 * SVG rendering helpers.
 *
 * The core render path already handles SVG attribute animation: every
 * property in `SVG_ATTRS` (`d`, `points`, `viewBox`, `stroke-*`, etc.)
 * classifies as `apply: "attr"`, which routes through `setAttribute`
 * in the rAF backend. Path values are matched by the registry's path
 * interpolator automatically, so `tween({ d: ["M0 0 L10 0", "M0 0 L20 0"] })`
 * just works.
 *
 * This module exposes a small helper for the most common SVG pattern
 * that isn't obvious from the primitives: drawing a stroke on. It
 * composes `stroke-dasharray` + `stroke-dashoffset` so the callsite is
 * one line rather than four.
 */

import { tween } from "../api/tween"
import type { AnimationDef } from "../core/types"
import type { AnimationProps } from "./strategy"

export interface StrokeDrawOpts {
  /** Total length of the path in user units. Use `SVGGeometryElement.getTotalLength()`. */
  readonly pathLength: number
  /** Duration of the draw in ms. Defaults to 800. */
  readonly duration?: number
  /** When true, the stroke retracts back to 0 instead of drawing on. */
  readonly reverse?: boolean
}

/**
 * Construct an animation that strokes a path on (or off).
 *
 *   const def = strokeDraw({ pathLength: el.getTotalLength(), duration: 1200 })
 *   play(def, [el])
 *
 * Drives `stroke-dasharray` and `stroke-dashoffset`. The dasharray is
 * set once to the full path length and stays constant; the dashoffset
 * animates from `pathLength` to 0 to reveal the stroke.
 */
export function strokeDraw(opts: StrokeDrawOpts): AnimationDef<AnimationProps> {
  const { pathLength, duration = 800, reverse = false } = opts
  const from = reverse ? 0 : pathLength
  const to = reverse ? pathLength : 0
  return tween(
    {
      strokeDasharray: [pathLength, pathLength],
      strokeDashoffset: [from, to],
    },
    { duration },
  )
}
