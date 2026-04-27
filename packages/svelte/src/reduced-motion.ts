/**
 * `reducedMotion` is a Svelte-compatible readable store whose value is
 * `true` when the OS-level `prefers-reduced-motion: reduce` pref is on.
 * The value updates as the OS toggle flips.
 *
 *   import { reducedMotion } from "@kinem/svelte"
 *
 *   $: animationOpts = $reducedMotion
 *     ? { reducedMotion: "always" }
 *     : { reducedMotion: "never" }
 *
 * Outside a browser the store stays `false`. Subscribers attach the
 * media-query listener on first subscribe and detach it on last
 * unsubscribe; multiple subscribers share a single MQL listener.
 */

import { prefersReducedMotion } from "@kinem/core"

const QUERY = "(prefers-reduced-motion: reduce)"

export interface ReducedMotionStore {
  subscribe(fn: (value: boolean) => void): () => void
}

export function createReducedMotionStore(): ReducedMotionStore {
  const subscribers = new Set<(v: boolean) => void>()
  let value = false
  let mql: MediaQueryList | null = null
  let onChange: ((e: MediaQueryListEvent) => void) | null = null

  const notify = (v: boolean): void => {
    for (const s of subscribers) s(v)
  }

  const attach = (): void => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    mql = window.matchMedia(QUERY)
    value = mql.matches
    onChange = (e) => {
      value = e.matches
      notify(value)
    }
    mql.addEventListener("change", onChange)
  }

  const detach = (): void => {
    if (mql && onChange) {
      mql.removeEventListener("change", onChange)
    }
    mql = null
    onChange = null
  }

  return {
    subscribe(fn) {
      if (subscribers.size === 0) attach()
      subscribers.add(fn)
      fn(value)
      return () => {
        subscribers.delete(fn)
        if (subscribers.size === 0) detach()
      }
    },
  }
}

/** Default shared store: subscribe directly via `$reducedMotion` in templates. */
export const reducedMotion: ReducedMotionStore = createReducedMotionStore()

export { prefersReducedMotion }
