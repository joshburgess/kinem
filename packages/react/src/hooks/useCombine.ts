/**
 * `useCombine(sources, fn)` returns a derived `MotionValue<T>` whose
 * value is recomputed from `fn(...sourceValues)` whenever any source
 * updates. The cell is rebuilt (and the previous one destroyed) only
 * when the source identities change; rebuilding `fn` between renders
 * does not rebuild the cell, so passing an inline lambda is safe.
 *
 *   const x = useMotionValue(0)
 *   const y = useMotionValue(0)
 *   const dist = useCombine([x, y], (a, b) => Math.hypot(a, b))
 */

import { type CombinedMotionValue, type MotionValue, combine } from "@kinem/core"
import { useEffect, useRef } from "react"

type SourceValues<S extends readonly MotionValue<unknown>[]> = {
  [K in keyof S]: S[K] extends MotionValue<infer V> ? V : never
}

export function useCombine<S extends readonly MotionValue<unknown>[], T>(
  sources: S,
  fn: (...values: SourceValues<S>) => T,
): CombinedMotionValue<T> {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const sourcesRef = useRef(sources)
  const mvRef = useRef<CombinedMotionValue<T> | null>(null)

  const sameSources =
    mvRef.current !== null &&
    sourcesRef.current.length === sources.length &&
    sourcesRef.current.every((s, i) => s === sources[i])

  if (!sameSources) {
    if (mvRef.current) mvRef.current.destroy()
    sourcesRef.current = sources
    mvRef.current = combine(sources, ((...values: SourceValues<S>) =>
      fnRef.current(...values)) as typeof fn)
  }

  useEffect(() => {
    return () => {
      mvRef.current?.destroy()
      mvRef.current = null
    }
  }, [])

  return mvRef.current as CombinedMotionValue<T>
}
