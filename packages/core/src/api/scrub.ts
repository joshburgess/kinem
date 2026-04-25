/**
 * Scrub an `AnimationDef` against an externally-driven progress signal.
 *
 * Unlike `play()`, which advances progress from its own clock, `scrub`
 * reads progress from a source you control: the current scroll position,
 * a gesture, an audio amplitude meter, a network metric, anything. The
 * def's interpolated values are applied to the targets each time
 * progress changes.
 */

import type { AnimationDef } from "../core/types"
import { applyValues } from "../render/apply"
import type { AnimationProps, StrategyTarget } from "../render/strategy"

export type RafLike = (cb: (time: number) => void) => number

export interface ScrubOpts {
  /**
   * If provided, a rAF loop polls this function each frame and applies
   * the resulting progress to the targets. Useful when progress is
   * derived from a signal that updates faster than you can hook (e.g.
   * audio frequency).
   */
  readonly source?: () => number
  /** Override raf for testing. */
  readonly raf?: RafLike
  /** Override cancelAnimationFrame for testing. */
  readonly cancelRaf?: (id: number) => void
  /** Called whenever progress is applied. Useful for side effects. */
  readonly onProgress?: (progress: number) => void
}

export interface ScrubHandle {
  /** Push a progress value and apply immediately. */
  setProgress(progress: number): void
  /** Stop the polling loop (if any) and detach. */
  cancel(): void
  readonly state: "active" | "cancelled"
  readonly progress: number
}

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

/**
 * Bind an `AnimationDef` to an external progress signal. Two modes:
 *
 * - **Pull** (`source` provided): a rAF loop polls `source()` per frame
 *   and applies the def's value to the targets. Cancel with `.cancel()`.
 * - **Push** (no `source`): the caller drives progress via
 *   `handle.setProgress(p)`. No rAF runs.
 *
 * ```ts
 * // Push-mode: drive from a pointer
 * const handle = scrub(motionPath(d), [el])
 * window.addEventListener("pointermove", e => {
 *   handle.setProgress(e.clientX / window.innerWidth)
 * })
 * ```
 */
export function scrub(
  def: AnimationDef<AnimationProps>,
  targets: readonly StrategyTarget[],
  opts: ScrubOpts = {},
): ScrubHandle {
  let state: "active" | "cancelled" = "active"
  let progress = 0
  let rafId = 0

  const apply = (p: number): void => {
    progress = clamp01(p)
    const values = def.interpolate(progress)
    for (const t of targets) applyValues(t, values)
    opts.onProgress?.(progress)
  }

  const source = opts.source
  if (source) {
    const raf: RafLike =
      opts.raf ??
      (typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame.bind(globalThis)
        : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number)
    const cancelRaf =
      opts.cancelRaf ??
      (typeof cancelAnimationFrame !== "undefined"
        ? cancelAnimationFrame.bind(globalThis)
        : (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>))
    const tick = (): void => {
      if (state === "cancelled") return
      apply(source())
      rafId = raf(tick)
    }
    rafId = raf(tick)
    return {
      setProgress(p) {
        apply(p)
      },
      cancel() {
        state = "cancelled"
        cancelRaf(rafId)
      },
      get state() {
        return state
      },
      get progress() {
        return progress
      },
    }
  }

  return {
    setProgress(p) {
      if (state === "cancelled") return
      apply(p)
    },
    cancel() {
      state = "cancelled"
    },
    get state() {
      return state
    },
    get progress() {
      return progress
    },
  }
}
