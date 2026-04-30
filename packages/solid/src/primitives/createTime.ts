/**
 * `createTime()` returns a `TimeMotionValue` that ticks on every
 * animation frame, holding milliseconds since the primitive ran. The
 * cell is destroyed when the current Solid owner is cleaned up.
 *
 *   const t = createTime()
 *   const opacity = createTransform(t, [0, 2000], [0, 1])
 */

import { type TimeMotionValue, time } from "@kinem/core"
import { onCleanup } from "solid-js"

export function createTime(): TimeMotionValue {
  const mv = time()
  onCleanup(() => mv.destroy())
  return mv
}
