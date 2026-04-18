/**
 * `play()` — the public entry point that connects a pure `AnimationDef`
 * to one or more DOM targets. Resolves the target argument (selector,
 * element, NodeList, array), dispatches through the strategy router,
 * and returns a PromiseLike `Controls` object.
 */

import type { AnimationDef } from "../core/types"
import { trackAnimation } from "../devtools/tracker"
import {
  type AnimationProps,
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

export interface PlayOpts extends StrategyOpts {
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
      throw new Error(
        "play(): cannot resolve selector string outside a DOM environment — pass elements directly or provide opts.resolve",
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
  const handle = playStrategy(def, targets, opts)
  // No eager `handle.finished.catch(noop)`: with lazy-allocated
  // promises, fire-and-forget cancel never creates a Promise, so there
  // is nothing to surface as unhandled. Callers that do access
  // `.finished` on a rejected handle get a pre-settled promise that
  // silences its own unhandled-rejection warning (see `lazy-promise`).
  const controls = createControls(handle, { duration: def.duration })
  trackAnimation(controls, targets, opts.backend ?? "auto")
  return controls
}
