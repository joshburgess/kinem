/**
 * `useMotionValueEvent(mv, "change", listener)` subscribes the listener
 * to change notifications on a MotionValue for the lifetime of the
 * calling component. Vue setups run once, so the listener identity is
 * captured at call time; close over reactive state inside it if you
 * need that.
 *
 *   useMotionValueEvent(x, "change", (v) => console.log(v))
 */

import {
  type MotionValue,
  type MotionValueEventName,
  type MotionValueListener,
  motionValueEvent,
} from "@kinem/core"
import { onBeforeUnmount } from "vue"

export function useMotionValueEvent<T>(
  mv: MotionValue<T>,
  event: MotionValueEventName,
  listener: MotionValueListener<T>,
): void {
  let off: (() => void) | null = motionValueEvent(mv, event, listener)
  onBeforeUnmount(() => {
    if (off) {
      off()
      off = null
    }
  })
}
