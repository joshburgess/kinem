/**
 * `motionValue(initial)` exposes a `MotionValue<T>` cell as a Svelte
 * readable store. Subscribers fire on every change; the store does NOT
 * pipe through Svelte's `writable`, so updates avoid the Svelte
 * scheduler entirely and stay sub-frame.
 *
 *   const x = motionValue(0)
 *   x.set(100)
 *   $: console.log($x) // reactive in Svelte components
 */

import {
  type MotionValue,
  type TransformInputRange,
  type TransformOpts,
  type TransformOutputRange,
  motionValue as coreMotionValue,
  transform as coreTransform,
} from "@kinem/core"

export interface MotionValueStore<T> extends MotionValue<T> {
  /** Svelte-compatible subscribe. Returns an unsubscribe. */
  subscribe(run: (value: T) => void): () => void
}

export function motionValue<T>(initial: T): MotionValueStore<T> {
  const mv = coreMotionValue(initial)
  return {
    ...mv,
    subscribe(run): () => void {
      run(mv.get())
      return mv.on((value) => run(value))
    },
    get: mv.get,
    set: mv.set,
    on: mv.on,
    getVelocity: mv.getVelocity,
    destroy: mv.destroy,
  }
}

export function transform<T>(
  source: MotionValue<number>,
  inputRange: TransformInputRange,
  outputRange: TransformOutputRange<T>,
  opts: TransformOpts = {},
): MotionValueStore<T> {
  const map = coreTransform(inputRange, outputRange, opts)
  const derived = motionValue<T>(map(source.get()))
  source.on((value) => {
    derived.set(map(value))
  })
  return derived
}
