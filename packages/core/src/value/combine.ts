/**
 * `combine(sources, fn)` returns a derived `MotionValue<T>` whose value
 * is recomputed from `fn(...sourceValues)` whenever any source emits.
 *
 *   const x = motionValue(0)
 *   const y = motionValue(0)
 *   const dist = combine([x, y], (a, b) => Math.hypot(a, b))
 *   x.set(3); y.set(4)
 *   dist.get() // 5
 *
 * The returned cell registers one listener per source. Calling
 * `.destroy()` unsubscribes from every source and clears local
 * listeners, so a single teardown call is enough to release the graph.
 *
 * `fn` is invoked synchronously on each upstream change, so keep it
 * cheap. For numeric reductions that should be smoothed, layer a
 * `transform()` over the result or feed it through a renderer.
 */

import { type MotionValue, motionValue } from "./motion-value"

export interface CombinedMotionValue<T> extends MotionValue<T> {
  /** Stop tracking all sources and clear listeners. */
  destroy(): void
}

type SourceValues<S extends readonly MotionValue<unknown>[]> = {
  [K in keyof S]: S[K] extends MotionValue<infer V> ? V : never
}

export function combine<S extends readonly MotionValue<unknown>[], T>(
  sources: S,
  fn: (...values: SourceValues<S>) => T,
): CombinedMotionValue<T> {
  const read = (): T => {
    const values = sources.map((s) => s.get()) as unknown as SourceValues<S>
    return fn(...values)
  }

  const mv = motionValue(read())
  const offs = sources.map((s) =>
    s.on(() => {
      mv.set(read())
    }),
  )
  const baseDestroy = mv.destroy
  return {
    get: mv.get,
    set: mv.set,
    on: mv.on,
    getVelocity: mv.getVelocity,
    destroy(): void {
      for (const off of offs) off()
      baseDestroy()
    },
  }
}
