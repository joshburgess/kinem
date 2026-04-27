/**
 * `useReducedMotion` returns `true` when the user has the OS-level
 * `prefers-reduced-motion: reduce` pref enabled. The value is reactive:
 * the hook subscribes to media-query changes so flipping the OS toggle
 * updates the component without a refresh.
 *
 *   const reduce = useReducedMotion()
 *   useAnimation(
 *     ref,
 *     tween({ opacity: [0, 1] }, { duration: 400 }),
 *     { reducedMotion: reduce ? "always" : "never" },
 *   )
 *
 * In SSR / non-browser environments the hook returns `false`. The
 * subscription is set up in `useEffect`, so the first server render
 * always agrees with the first client render.
 */

import { prefersReducedMotion } from "@kinem/core"
import { useEffect, useState } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    const mql = window.matchMedia(QUERY)
    setReduce(mql.matches)
    const onChange = (e: MediaQueryListEvent): void => setReduce(e.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return reduce
}

/** Re-export of the core helper for non-reactive checks. */
export { prefersReducedMotion }
