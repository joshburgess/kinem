/**
 * Canvas (and general non-DOM) animation driver. The user supplies a
 * `commit(values)` callback; every frame, the engine computes the
 * interpolated values and hands them over. The user draws whatever
 * they like with those numbers.
 *
 *   const controls = playCanvas(
 *     tween({ x: [0, 200], alpha: [0, 1] }, { duration: 600 }),
 *     (v) => {
 *       ctx.clearRect(0, 0, w, h)
 *       ctx.globalAlpha = v.alpha
 *       ctx.fillRect(v.x, 0, 40, 40)
 *     },
 *   )
 *
 * Timing semantics (pause, seek, reverse, speed) are identical to the
 * DOM rAF backend because both build on the same `createTiming`
 * helper. Works in any environment with `requestAnimationFrame` (or
 * via a custom scheduler).
 */

import type { AnimationDef } from "../core/types"
import { type TimingHandle, type TimingOpts, createTiming } from "./timing"

export type CanvasHandle = TimingHandle
export type CanvasOpts = TimingOpts

export type CanvasCommit<V> = (values: V) => void

export function playCanvas<V>(
  def: AnimationDef<V>,
  commit: CanvasCommit<V>,
  opts: CanvasOpts = {},
): CanvasHandle {
  return createTiming(def, commit, opts)
}
