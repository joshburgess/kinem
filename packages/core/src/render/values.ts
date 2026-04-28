/**
 * Generic value-callback animation driver. The user supplies an
 * `onValue(values)` callback; every frame, the engine computes the
 * interpolated values and hands them over. The user does whatever they
 * like with the numbers — draw to a canvas, write to inline transforms,
 * push WebGL uniforms, post to a worker, anything.
 *
 *   const controls = playValues(
 *     tween({ x: [0, 200], alpha: [0, 1] }, { duration: 600 }),
 *     (v) => {
 *       ctx.clearRect(0, 0, w, h)
 *       ctx.globalAlpha = v.alpha
 *       ctx.fillRect(v.x, 0, 40, 40)
 *     },
 *   )
 *
 * Timing semantics (pause, seek, reverse, speed) are identical to the
 * DOM rAF backend because both build on the same `createTiming` helper.
 * Works in any environment with `requestAnimationFrame` (or via a custom
 * scheduler).
 */

import { createControls } from "../api/controls"
import type { AnimationDef } from "../core/types"
import { isTrackerEnabled, trackAnimation } from "../devtools/tracker"
import { type TimingHandle, type TimingOpts, createTiming } from "./timing"

export type ValuesHandle = TimingHandle
export type ValuesOpts = TimingOpts

export type ValuesCommit<V> = (values: V) => void

export function playValues<V>(
  def: AnimationDef<V>,
  onValue: ValuesCommit<V>,
  opts: ValuesOpts = {},
): ValuesHandle {
  const handle = createTiming(def, onValue, opts)
  // When the tracker is enabled, expose this animation to the devtools
  // panel by wrapping the timing handle in a Controls (cheap; only the
  // PromiseLike adapter on top of the same handle) and registering it.
  // Targets is empty because `playValues` doesn't know about DOM
  // elements; the user owns the commit. Backend label is "raf" — every
  // values-callback animation runs through the rAF scheduler.
  if (isTrackerEnabled()) {
    const controls = createControls(handle, def.duration)
    trackAnimation(controls, [], "raf")
  }
  return handle
}
