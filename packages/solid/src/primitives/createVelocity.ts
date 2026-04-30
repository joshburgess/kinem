/**
 * `createVelocity(source)` returns a `MotionValue<number>` that mirrors
 * the per-second derivative of a numeric source `MotionValue`. The cell
 * is destroyed when the current Solid owner is cleaned up.
 *
 *   const x = createMotionValue(0)
 *   const vx = createVelocity(x)
 */

import { type MotionValue, type VelocityMotionValue, velocity } from "@kinem/core"
import { onCleanup } from "solid-js"

export function createVelocity(source: MotionValue<number>): VelocityMotionValue {
  const mv = velocity(source)
  onCleanup(() => mv.destroy())
  return mv
}
