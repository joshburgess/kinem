/**
 * `useVelocity(source)` returns a `MotionValue<number>` that mirrors
 * the per-second derivative of a numeric source `MotionValue`. The cell
 * is destroyed when the calling component unmounts.
 *
 *   const x = useMotionValue(0)
 *   const vx = useVelocity(x)
 */

import { type MotionValue, type VelocityMotionValue, velocity } from "@kinem/core"
import { onBeforeUnmount } from "vue"

export function useVelocity(source: MotionValue<number>): VelocityMotionValue {
  const mv = velocity(source)
  onBeforeUnmount(() => {
    mv.destroy()
  })
  return mv
}
