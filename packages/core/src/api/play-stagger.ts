/**
 * `playStagger()` — fan-out driver that plays the same `AnimationDef`
 * across N targets with per-index delays.
 *
 * The low-level `stagger()` combinator (in `core/animation`) returns an
 * `AnimationDef<readonly T[]>` whose value is an array of per-element
 * values. That's the right shape for callers who want to commit those
 * values themselves. Most callers just want "fire this animation across
 * these elements with a 50ms gap, with a single Controls handle to
 * pause/cancel them all" — that's `playStagger`.
 */

import { delay as delayDef } from "../core/animation"
import type { AnimationDef, StaggerFrom } from "../core/types"
import {
  type AnimationProps,
  type StrategyBackend,
  type StrategyHandle,
  combineHandles,
  playStrategy,
} from "../render/strategy"
import { type Controls, createControls } from "./controls"
import { type PlayOpts, type Target, resolveTargets } from "./play"

const MODE_TO_BACKEND: Record<string, StrategyBackend> = {
  auto: "auto",
  compositor: "waapi",
  main: "raf",
}

export interface PlayStaggerOpts extends PlayOpts {
  /** ms between successive starts. */
  readonly each: number
  /**
   * Stagger origin — index that starts at offset 0. Defaults to `"start"`.
   *
   *  - `"start"`: 0, 1, 2, … (left to right)
   *  - `"end"`: N-1, N-2, … (right to left)
   *  - `"center"`: outward from the middle index
   *  - `"edges"`: inward from both ends
   *  - number: outward from this index
   *  - function: `(i, count) => number` returning the per-index order
   */
  readonly from?: StaggerFrom
}

const staggerOrder = (i: number, count: number, from: StaggerFrom): number => {
  if (typeof from === "function") return from(i, count)
  switch (from) {
    case "start":
      return i
    case "end":
      return count - 1 - i
    case "center": {
      const mid = (count - 1) / 2
      return Math.abs(i - mid)
    }
    case "edges": {
      const mid = (count - 1) / 2
      return mid - Math.min(i, count - 1 - i)
    }
    default:
      return Math.abs(i - from)
  }
}

/**
 * Play `def` across every target with per-index delays. Returns a single
 * `Controls` whose lifecycle covers all per-target animations.
 *
 * ```ts
 * playStagger(tween({ y: [20, 0], opacity: [0, 1] }, { duration: 400 }), ".dot", {
 *   each: 40,
 *   from: "center",
 * })
 * ```
 */
export function playStagger(
  def: AnimationDef<AnimationProps>,
  target: Target,
  opts: PlayStaggerOpts,
): Controls {
  const targets = resolveTargets(target, opts)
  const each = opts.each
  const from: StaggerFrom = opts.from ?? "start"
  const backend: StrategyBackend =
    opts.backend ?? (opts.mode !== undefined ? (MODE_TO_BACKEND[opts.mode] ?? "auto") : "auto")

  if (targets.length === 0) {
    return createControls(combineHandles([]), 0)
  }

  // Pre-compute per-index orders, shift to start at 0.
  const count = targets.length
  let minOrder = Number.POSITIVE_INFINITY
  const orders = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    const o = staggerOrder(i, count, from)
    orders[i] = o
    if (o < minOrder) minOrder = o
  }

  const handles: StrategyHandle[] = []
  let totalDuration = 0
  for (let i = 0; i < count; i++) {
    const ms = ((orders[i] as number) - minOrder) * each
    const childDef = ms === 0 ? def : delayDef(def, ms)
    if (childDef.duration > totalDuration) totalDuration = childDef.duration
    handles.push(playStrategy(childDef, [targets[i] as never], opts, backend))
  }

  return createControls(combineHandles(handles), totalDuration)
}
