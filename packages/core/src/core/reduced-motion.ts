/**
 * Honour `prefers-reduced-motion`. When the user's OS-level pref says
 * "reduce", consumers can opt their animations into snap-to-end
 * behaviour: the final value is committed immediately, no rAF or WAAPI
 * setup happens, and `finished` resolves on the next microtask.
 *
 * The library default is `"never"` — `play()` does not consult the pref
 * unless the consumer asks. This matches motion / framer-motion: a
 * library can't know which animations are decorative vs functional, so
 * the consumer has to opt in, either per-call or by setting a global
 * default via `setReducedMotionDefault()`.
 *
 * Use `"user"` to delegate to the OS pref; this is the interesting
 * value, and the one that should be set globally in apps that care.
 */

export type ReducedMotion =
  /** Always snap to end. Useful for testing the reduced path. */
  | "always"
  /** Never snap. Run animations as authored. The library default. */
  | "never"
  /** Snap iff `(prefers-reduced-motion: reduce)` matches. */
  | "user"

let globalDefault: ReducedMotion = "never"

/**
 * Set the process-wide default for `reducedMotion` on `play()` /
 * `timeline().play()`. Per-call options still win over the default.
 *
 * Typical app usage at startup:
 *
 * ```ts
 * setReducedMotionDefault("user")
 * ```
 */
export function setReducedMotionDefault(mode: ReducedMotion): void {
  globalDefault = mode
}

export function getReducedMotionDefault(): ReducedMotion {
  return globalDefault
}

/**
 * True when the OS-level `prefers-reduced-motion: reduce` pref is set.
 * Returns `false` outside a browser environment.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Resolve a `ReducedMotion` setting to a boolean snap decision. `mode`
 * defaults to whatever was set via `setReducedMotionDefault`.
 */
export function shouldReduceMotion(mode?: ReducedMotion): boolean {
  const m = mode ?? globalDefault
  if (m === "always") return true
  if (m === "never") return false
  return prefersReducedMotion()
}
