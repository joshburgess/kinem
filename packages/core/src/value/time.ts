/**
 * `time()` returns a `MotionValue<number>` that ticks on every animation
 * frame, holding milliseconds since the cell was created. It is meant
 * as a driver for `transform()` chains or other MotionValues that want
 * to follow wall-clock time without each consumer running its own rAF
 * loop.
 *
 *   const t = time()
 *   const wave = transform([0, 1000], [0, 1])
 *   t.on((ms) => el.style.opacity = String(wave(ms % 1000)))
 *
 * The tick stops automatically when the cell has no listeners, and
 * resumes when a listener is added. Call `.destroy()` to drop it
 * permanently. In SSR (no `requestAnimationFrame`), `set()` is never
 * called and the value stays at its initial 0.
 */

import { type MotionValue, type Unsubscribe, motionValue } from "./motion-value"

const raf = (cb: (t: number) => void): number => {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(cb)
  return 0
}

const cancelRaf = (id: number): void => {
  if (id !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(id)
}

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

export interface TimeMotionValue extends MotionValue<number> {
  /** Stop the rAF loop and clear listeners. */
  destroy(): void
}

export function time(): TimeMotionValue {
  const start = now()
  const mv = motionValue(0)
  let frameId = 0
  let running = false

  const tick = (): void => {
    mv.set(now() - start)
    frameId = raf(tick)
  }

  const start_ = (): void => {
    if (running) return
    running = true
    frameId = raf(tick)
  }

  const stop = (): void => {
    if (!running) return
    running = false
    cancelRaf(frameId)
    frameId = 0
  }

  const baseOn = mv.on
  const baseDestroy = mv.destroy
  let listenerCount = 0

  const on = (listener: (value: number, prev: number) => void): Unsubscribe => {
    listenerCount++
    if (listenerCount === 1) start_()
    const off = baseOn(listener)
    return () => {
      off()
      listenerCount = Math.max(0, listenerCount - 1)
      if (listenerCount === 0) stop()
    }
  }

  return {
    get: mv.get,
    set: mv.set,
    on,
    getVelocity: mv.getVelocity,
    destroy(): void {
      stop()
      listenerCount = 0
      baseDestroy()
    },
  }
}
