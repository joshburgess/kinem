/**
 * `createMotionValueEvent(mv, "change", listener)` subscribes the
 * listener to change notifications on a MotionValue for the lifetime
 * of the current Solid owner.
 *
 *   createMotionValueEvent(x, "change", (v) => console.log(v))
 */

import {
  type MotionValue,
  type MotionValueEventName,
  type MotionValueListener,
  motionValueEvent,
} from "@kinem/core"
import { onCleanup } from "solid-js"

export function createMotionValueEvent<T>(
  mv: MotionValue<T>,
  event: MotionValueEventName,
  listener: MotionValueListener<T>,
): void {
  const off = motionValueEvent(mv, event, listener)
  onCleanup(off)
}
