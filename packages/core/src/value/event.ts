/**
 * `motionValueEvent(mv, "change", listener)` is an ergonomic wrapper
 * around `mv.on(listener)`. It exists mostly to mirror Framer Motion's
 * `useMotionValueEvent` shape so framework hooks have a uniform name to
 * delegate to, and to leave room for additional event names in the
 * future (e.g. `"animationStart"`) without breaking the call sites.
 *
 *   const stop = motionValueEvent(x, "change", (v) => console.log(v))
 *   stop()
 */

import type { MotionValue, MotionValueListener, Unsubscribe } from "./motion-value"

export type MotionValueEventName = "change"

export function motionValueEvent<T>(
  mv: MotionValue<T>,
  event: MotionValueEventName,
  listener: MotionValueListener<T>,
): Unsubscribe {
  if (event !== "change") {
    throw new Error(`motionValueEvent: unsupported event "${event}"`)
  }
  return mv.on(listener)
}
