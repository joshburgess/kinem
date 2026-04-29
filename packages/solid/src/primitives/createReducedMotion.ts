/**
 * `createReducedMotion` returns a Solid `Accessor<boolean>` that tracks
 * the OS-level `prefers-reduced-motion: reduce` media query.
 *
 *   const reduce = createReducedMotion()
 *   createEffect(() => {
 *     play(tween(...), [el], { reducedMotion: reduce() ? "always" : "never" })
 *   })
 *
 * In SSR / non-browser environments the accessor returns `false`. The
 * subscription is set up on mount, so the first server render and the
 * first client render agree.
 */

import { prefersReducedMotion } from "@kinem/core"
import { type Accessor, createSignal, onCleanup, onMount } from "solid-js"

const QUERY = "(prefers-reduced-motion: reduce)"

export function createReducedMotion(): Accessor<boolean> {
  const [reduce, setReduce] = createSignal(false)

  onMount(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mql = window.matchMedia(QUERY)
    setReduce(mql.matches)
    const onChange = (e: MediaQueryListEvent): void => {
      setReduce(e.matches)
    }
    mql.addEventListener("change", onChange)
    onCleanup(() => mql.removeEventListener("change", onChange))
  })

  return reduce
}

/** Re-export of the core helper for non-reactive checks. */
export { prefersReducedMotion }
