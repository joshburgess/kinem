/**
 * `useReducedMotion` returns a `Ref<boolean>` that is `true` when the
 * user has the OS-level `prefers-reduced-motion: reduce` pref enabled.
 * The ref updates reactively when the OS toggle flips.
 *
 *   const reduce = useReducedMotion()
 *   useAnimation(
 *     ref,
 *     tween({ opacity: [0, 1] }, { duration: 400 }),
 *     { reducedMotion: reduce.value ? "always" : "never" },
 *   )
 *
 * Outside a browser the ref stays `false`. The media-query subscription
 * is set up `onMounted` and torn down `onBeforeUnmount`.
 */

import { prefersReducedMotion } from "@kinem/core"
import { type Ref, onBeforeUnmount, onMounted, ref } from "vue"

const QUERY = "(prefers-reduced-motion: reduce)"

export function useReducedMotion(): Ref<boolean> {
  const reduce = ref(false)
  let mql: MediaQueryList | null = null
  let onChange: ((e: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    mql = window.matchMedia(QUERY)
    reduce.value = mql.matches
    onChange = (e) => {
      reduce.value = e.matches
    }
    mql.addEventListener("change", onChange)
  })

  onBeforeUnmount(() => {
    if (mql && onChange) {
      mql.removeEventListener("change", onChange)
    }
    mql = null
    onChange = null
  })

  return reduce
}

export { prefersReducedMotion }
