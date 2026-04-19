/**
 * `spring` creates a Svelte-compatible store whose scalar value is
 * animated by a spring sampler. It implements the minimal readable
 * store contract (`subscribe`) plus imperative controls (`set`,
 * `update`, `jump`, `stop`) so it can be consumed via the `$` prefix
 * in templates:
 *
 *   const x = spring(0, { stiffness: 180 })
 *   x.set(100)             // animate toward 100
 *   $: console.log($x)     // reactive in Svelte components
 *
 * Subscribers are invoked on every rAF tick of an in-flight spring.
 * The store does not use Svelte's `writable`; it integrates with the
 * kinem frame scheduler directly so the trajectory matches
 * `springEasing` used elsewhere in the library.
 */

import { type SpringOpts, frame, springEasing } from "@kinem/core"

export type SpringStoreOpts = SpringOpts

export interface SpringStore {
  subscribe(fn: (value: number) => void): () => void
  set(target: number): void
  update(fn: (v: number) => number): void
  jump(value: number): void
  stop(): void
  readonly isAnimating: boolean
}

export function spring(initial: number, opts: SpringStoreOpts = {}): SpringStore {
  let value = initial
  let animating = false
  let activeTick: ((state: { time: number }) => void) | null = null
  const subscribers = new Set<(v: number) => void>()

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

  const go = (target: number): void => {
    if (value === target) {
      cancelCurrent()
      return
    }
    cancelCurrent()
    const start = value
    const easing = springEasing(opts)
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
  }

  return {
    subscribe(fn) {
      subscribers.add(fn)
      fn(value)
      return () => {
        subscribers.delete(fn)
      }
    },
    set(target) {
      go(target)
    },
    update(fn) {
      go(fn(value))
    },
    jump(v) {
      cancelCurrent()
      value = v
      notify(v)
    },
    stop() {
      cancelCurrent()
    },
    get isAnimating() {
      return animating
    },
  }
}
