/**
 * `useSpring` returns a scalar value animated by a spring. It is
 * imperative by design: reading `.get()` or subscribing does not cause
 * reactive updates. Drive DOM directly by attaching a subscriber, or
 * combine with `watchEffect` to consume the current value in a
 * non-reactive way.
 *
 *   const x = useSpring(0, { stiffness: 170 })
 *   x.set(100)                 // animate toward 100
 *   x.subscribe(v => ...)      // raf-frequency updates
 *
 * The spring restarts from the current value on each `set()`. The
 * underlying sampler is `springEasing` from the core package, so the
 * trajectory and settling behaviour match `spring()` used elsewhere.
 */

import { type SpringOpts, frame, springEasing } from "@kinem/core"
import { onBeforeUnmount } from "vue"

export interface SpringValue {
  /** Current value. Reading is synchronous; no reactive update fires. */
  get(): number
  /** Start a spring from the current value to `target`. */
  set(target: number): void
  /** Instantly jump to `value` and cancel any in-flight animation. */
  jump(value: number): void
  /** Subscribe to value updates. Called on every rAF tick of the spring. */
  subscribe(fn: (value: number) => void): () => void
  /** Cancel any in-flight spring. The value stays at its current sample. */
  stop(): void
  /** True while a spring is in progress. */
  readonly isAnimating: boolean
}

export function useSpring(initial: number, opts: SpringOpts = {}): SpringValue {
  let value = initial
  let animating = false
  let activeTick: ((state: { time: number }) => void) | null = null
  const subscribers = new Set<(v: number) => void>()
  const currentOpts = opts

  const notify = (v: number): void => {
    for (const s of subscribers) s(v)
  }

  const cancelCurrent = (): void => {
    if (activeTick) {
      frame.cancel("update", activeTick)
      activeTick = null
    }
    animating = false
  }

  const api: SpringValue = {
    get() {
      return value
    },
    jump(v) {
      cancelCurrent()
      value = v
      notify(v)
    },
    set(target) {
      if (value === target) {
        cancelCurrent()
        return
      }
      cancelCurrent()
      const start = value
      const easing = springEasing(currentOpts)
      const duration = easing.duration
      let startTime = -1

      const tick: (state: { time: number }) => void = (state) => {
        if (startTime < 0) startTime = state.time
        const elapsed = state.time - startTime
        const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1
        const v = start + (target - start) * easing(progress)
        value = v
        notify(v)
        if (progress >= 1) {
          value = target
          notify(target)
          if (activeTick === tick) {
            frame.cancel("update", tick)
            activeTick = null
            animating = false
          }
        }
      }
      activeTick = tick
      animating = true
      frame.schedule("update", tick, { keepalive: true })
    },
    subscribe(fn) {
      subscribers.add(fn)
      return () => {
        subscribers.delete(fn)
      }
    },
    stop() {
      cancelCurrent()
    },
    get isAnimating() {
      return animating
    },
  }

  onBeforeUnmount(() => {
    cancelCurrent()
    subscribers.clear()
  })

  return api
}
