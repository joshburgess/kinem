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
  type CombinedMotionValue,
  type MotionValue,
  type TransformInputRange,
  type TransformOpts,
  type TransformOutputRange,
  combine as coreCombine,
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
  const off = source.on((value) => {
    derived.set(map(value))
  })
  const innerDestroy = derived.destroy
  return {
    ...derived,
    destroy: () => {
      off()
      innerDestroy()
    },
  }
}

type SourceValues<S extends readonly MotionValue<unknown>[]> = {
  [K in keyof S]: S[K] extends MotionValue<infer V> ? V : never
}

export interface CombinedMotionValueStore<T> extends CombinedMotionValue<T> {
  /** Svelte-compatible subscribe. Returns an unsubscribe. */
  subscribe(run: (value: T) => void): () => void
}

export function combine<S extends readonly MotionValue<unknown>[], T>(
  sources: S,
  fn: (...values: SourceValues<S>) => T,
): CombinedMotionValueStore<T> {
  const mv = coreCombine(sources, fn)
  return {
    get: mv.get,
    set: mv.set,
    on: mv.on,
    getVelocity: mv.getVelocity,
    destroy: mv.destroy,
    subscribe(run): () => void {
      run(mv.get())
      return mv.on((value) => run(value))
    },
  }
}
