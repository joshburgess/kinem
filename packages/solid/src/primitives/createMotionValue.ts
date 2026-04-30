/**
 * `createMotionValue(initial)` returns a stable `MotionValue<T>` cell
 * tied to the current Solid owner. Updates do not mark Solid signals
 * dirty: subscribers (CSS bindings, transforms, gestures) read directly
 * via `get()` / `on()`.
 */

import { type MotionValue, motionValue } from "@kinem/core"
import { onCleanup } from "solid-js"

export function createMotionValue<T>(initial: T): MotionValue<T> {
  const mv = motionValue(initial)
  onCleanup(() => mv.destroy())
  return mv
}
