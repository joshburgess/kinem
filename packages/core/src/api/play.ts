/**
 * `play()` — the public entry point that connects a pure `AnimationDef`
 * to one or more DOM targets. Resolves the target argument (selector,
 * element, NodeList, array), dispatches through the strategy router,
 * and returns a PromiseLike `Controls` object.
 */

import { KinemError } from "../core/errors"
import type { AnimationDef } from "../core/types"
import { trackAnimation } from "../devtools/tracker"
import {
  type AnimationProps,
  type StrategyBackend,
  type StrategyOpts,
  type StrategyTarget,
  playStrategy,
} from "../render/strategy"
import { type Controls, createControls } from "./controls"

/**
 * A target specification. Accepts:
 *  - a CSS selector string (`".card"`), resolved via `document.querySelectorAll`
 *  - a single element
 *  - a `NodeList` / `HTMLCollection`
 *  - an array of elements
 */
export type Target = string | StrategyTarget | readonly StrategyTarget[] | ArrayLike<StrategyTarget>

/**
 * Where an animation's *timing* runs.
 *
 *  - `"compositor"` (the default when supported): hands the animation
 *    off to the browser's compositor via `Element.animate()`. Paint
 *    and composite happen on the GPU, and crucially the *timing* keeps
 *    advancing even when the main thread is blocked (heavy React
 *    render, long task, etc). Costs a bit more to set up because we
 *    sample the easing and hand a keyframes array to the browser.
 *
 *  - `"main"`: ticks per frame from JS on the main thread and writes
 *    the current value to `element.style`. Setup is essentially free
 *    (no keyframe sampling, no compositor negotiation), which makes
 *    this the right pick for hover microinteractions, rapid toggles,
 *    or anywhere startup latency dominates. If the main thread blocks,
 *    timing pauses along with it.
 *
 *  - `"auto"` (default): compositor-safe properties route to
 *    `"compositor"`, the rest to `"main"`. This is the right pick
 *    for almost every animation; reach for the others only when you
 *    know you want one specific behavior.
 *
 * Corresponds 1:1 with the low-level `backend` option: `"compositor"`
 * maps to `"waapi"`, `"main"` maps to `"raf"`. If both are passed,
 * `backend` wins.
 */
export type PlayMode = "auto" | "compositor" | "main"

const MODE_TO_BACKEND: Record<PlayMode, StrategyBackend> = {
  auto: "auto",
  compositor: "waapi",
  main: "raf",
}

/**
 * Translate the user-facing `mode` option to the low-level `backend`.
 * Exported so timeline and other internal entry points can honour
 * `mode` without re-implementing the mapping.
 *
 * If the caller passed `backend` directly, respect it. `mode` only
 * applies when `backend` is absent.
 */
export function resolveStrategyOpts(opts: PlayOpts): StrategyOpts {
  if (opts.mode === undefined || opts.backend !== undefined) return opts
  return { ...opts, backend: MODE_TO_BACKEND[opts.mode] }
}

export interface PlayOpts extends StrategyOpts {
  /**
   * Where timing runs. See {@link PlayMode}. Default `"auto"`.
   */
  readonly mode?: PlayMode
  /**
   * Override selector resolution. If provided, selector strings are
   * resolved by this function instead of `document.querySelectorAll`.
   * Useful in non-DOM environments and tests.
   */
  readonly resolve?: (selector: string) => readonly StrategyTarget[]
}

/**
 * Resolve a `Target` argument into a flat, typed array of elements.
 * Exported for internal reuse by the timeline module.
 */
export function resolveTargets(target: Target, opts: PlayOpts): readonly StrategyTarget[] {
  if (typeof target === "string") {
    if (opts.resolve) return opts.resolve(target)
    if (typeof document === "undefined") {
      throw new KinemError(
        "play(): cannot resolve selector string outside a DOM environment",
        "pass elements directly or provide opts.resolve",
      )
    }
    const nodes = document.querySelectorAll(target)
    return Array.from(nodes) as unknown as readonly StrategyTarget[]
  }
  if (Array.isArray(target)) return target as readonly StrategyTarget[]
  // ArrayLike (NodeList, HTMLCollection)
  if (typeof (target as ArrayLike<StrategyTarget>).length === "number") {
    return Array.from(target as ArrayLike<StrategyTarget>)
  }
  // Single element
  return [target as StrategyTarget]
}

export function play(
  def: AnimationDef<AnimationProps>,
  target: Target,
  opts: PlayOpts = {},
): Controls {
  const targets = resolveTargets(target, opts)
  // Resolve the backend inline rather than going through
  // `resolveStrategyOpts`, which would spread `opts` into a new object
  // when `mode` is set. `playStrategy` accepts a backend override, so
  // we can leave `opts` unchanged and pay zero allocs here.
  const backend: StrategyBackend =
    opts.backend ?? (opts.mode !== undefined ? MODE_TO_BACKEND[opts.mode] : "auto")
  const handle = playStrategy(def, targets, opts, backend)
  // No eager `handle.finished.catch(noop)`: with lazy-allocated
  // promises, fire-and-forget cancel never creates a Promise, so there
  // is nothing to surface as unhandled. Callers that do access
  // `.finished` on a rejected handle get a pre-settled promise that
  // silences its own unhandled-rejection warning (see `lazy-promise`).
  const controls = createControls(handle, def.duration)
  trackAnimation(controls, targets, backend)
  return controls
}
