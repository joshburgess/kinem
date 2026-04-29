/**
 * `createSpring` returns a scalar value animated by a spring. The
 * primitive is imperative by design: reading `.get()` or subscribing
 * does not trigger Solid signal updates. Drive DOM directly by
 * attaching a subscriber, or read `.get()` from inside a `createEffect`
 * that tracks an external trigger.
 *
 *   const x = createSpring(0, { stiffness: 170 })
 *   x.set(100)                 // animate toward 100
 *   x.subscribe(v => ...)      // raf-frequency updates
 *
 * Spring trajectory and settling match `springEasing` from `@kinem/core`.
 */

import { type SpringOpts, frame, springEasing } from "@kinem/core"
import { onCleanup } from "solid-js"

export interface SpringValue {
  /** Current value. Reading is synchronous and reactive-free. */
  get(): number
  /** Start a spring from the current value to `target`. */
  set(target: number): void
  /** Instantly jump to `value` and cancel any in-flight animation. */
  jump(value: number): void
  /** Subscribe to value updates on each rAF tick. */
  subscribe(fn: (value: number) => void): () => void
  /** Cancel any in-flight spring. The value stays at its current sample. */
  stop(): void
  /** True while a spring is in progress. */
  readonly isAnimating: boolean
}

interface Animation {
  tick(state: { time: number }): void
  cancel(): void
}

export function createSpring(initial: number, opts: SpringOpts = {}): SpringValue {
  let value = initial
  let anim: Animation | null = null
  const subscribers = new Set<(v: number) => void>()

  const notify = (v: number): void => {
    for (const s of subscribers) s(v)
  }
  const cancelCurrent = (): void => {
    if (anim) {
      anim.cancel()
      anim = null
    }
  }

  onCleanup(() => {
    cancelCurrent()
    subscribers.clear()
  })

  return {
    get() {
      return value
    },
    jump(v) {
      cancelCurrent()
      value = v
      notify(v)
    },
    set(target) {
      const start = value
      if (start === target) {
        cancelCurrent()
        return
      }
      cancelCurrent()
      const easing = springEasing(opts)
      const duration = easing.duration
      let startTime = -1

      const tick: Animation["tick"] = (state) => {
        if (startTime < 0) startTime = state.time
        const elapsed = state.time - startTime
        const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1
        const v = start + (target - start) * easing(progress)
        value = v
        notify(v)
        if (progress >= 1) {
          value = target
          notify(target)
          anim = null
          frame.cancel("update", tick)
        }
      }

      anim = {
        tick,
        cancel() {
          frame.cancel("update", tick)
        },
      }
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
      return anim !== null
    },
  }
}
