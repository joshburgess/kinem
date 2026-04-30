/**
 * `velocity(source)` returns a `MotionValue<number>` that mirrors the
 * per-second derivative of a numeric source `MotionValue`. It updates
 * whenever the source updates, by reading `source.getVelocity()`.
 *
 *   const x = motionValue(0)
 *   const vx = velocity(x)
 *   x.set(100); x.set(200)
 *   vx.get() // velocity in units/sec
 *
 * The returned cell registers a single listener on the source and
 * mirrors that subscription. `.destroy()` unsubscribes from the source
 * and clears local listeners. Useful for spring-on-release, throw
 * gestures, or `transform()`-driven UI that responds to pace rather
 * than position.
 */

import { type MotionValue, type Unsubscribe, motionValue } from "./motion-value"

export interface VelocityMotionValue extends MotionValue<number> {
  /** Stop tracking and clear listeners. */
  destroy(): void
}

export function velocity(source: MotionValue<number>): VelocityMotionValue {
  const mv = motionValue(source.getVelocity())
  const off = source.on(() => {
    mv.set(source.getVelocity())
  })
  const baseDestroy = mv.destroy
  return {
    get: mv.get,
    set: mv.set,
    on: mv.on,
    getVelocity: mv.getVelocity,
    destroy(): void {
      off()
      baseDestroy()
    },
  }
}
