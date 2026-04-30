/**
 * `createCombine(sources, fn)` returns a derived `MotionValue<T>` whose
 * value is recomputed from `fn(...sourceValues)` whenever any source
 * updates. The cell is destroyed when the current Solid owner is
 * cleaned up.
 *
 *   const x = createMotionValue(0)
 *   const y = createMotionValue(0)
 *   const dist = createCombine([x, y], (a, b) => Math.hypot(a, b))
 */

import { type CombinedMotionValue, type MotionValue, combine } from "@kinem/core"
import { onCleanup } from "solid-js"

type SourceValues<S extends readonly MotionValue<unknown>[]> = {
  [K in keyof S]: S[K] extends MotionValue<infer V> ? V : never
}

export function createCombine<S extends readonly MotionValue<unknown>[], T>(
  sources: S,
  fn: (...values: SourceValues<S>) => T,
): CombinedMotionValue<T> {
  const mv = combine(sources, fn)
  onCleanup(() => mv.destroy())
  return mv
}
