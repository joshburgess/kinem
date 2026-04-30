/**
 * `useMotionValueEvent(mv, "change", listener)` subscribes the listener
 * to change notifications on a MotionValue for the lifetime of the
 * component. The latest listener identity is used on every fire, so the
 * caller does not need to memoise it.
 *
 *   useMotionValueEvent(x, "change", (v) => console.log(v))
 */

import {
  type MotionValue,
  type MotionValueEventName,
  type MotionValueListener,
  motionValueEvent,
} from "@kinem/core"
import { useEffect, useRef } from "react"

export function useMotionValueEvent<T>(
  mv: MotionValue<T>,
  event: MotionValueEventName,
  listener: MotionValueListener<T>,
): void {
  const listenerRef = useRef(listener)
  listenerRef.current = listener
  useEffect(() => {
    return motionValueEvent(mv, event, (value, prev) => {
      listenerRef.current(value, prev)
    })
  }, [mv, event])
}
