/**
 * Public gesture API. Exposes `gesture.drag` and `gesture.hover` as
 * thin wrappers around the gesture drivers that accept the same `Target`
 * argument as `play()` (selector / element / array), plus a separate
 * `target` option for the element that owns the pointer events (which
 * may or may not be the element being animated).
 *
 * Both helpers return a driver-specific handle. Cancel semantics mirror
 * `play()`: the handle's `cancel()` detaches listeners and stops any
 * in-flight animation.
 */

import type { DragHandle, DragOpts } from "../gesture/drag"
import { playDrag } from "../gesture/drag"
import type { HoverHandle, HoverOpts } from "../gesture/hover"
import { playHover } from "../gesture/hover"
import type { PointerBindTarget } from "../gesture/pointer"
import { type PlayOpts, type Target, resolveTargets } from "./play"

export type GestureTarget = Target

export type DragPublicOpts = Omit<DragOpts, "target"> & {
  /**
   * The element that owns the pointer events. Defaults to the first
   * resolved target. Pass explicitly when the pointer-listening element
   * differs from the elements being animated (e.g., a handle inside a
   * larger panel).
   */
  readonly target?: PointerBindTarget
  readonly resolve?: PlayOpts["resolve"]
}

export type HoverPublicOpts = Omit<HoverOpts, "target"> & {
  readonly target?: PointerBindTarget
  readonly resolve?: PlayOpts["resolve"]
}

function pickPointerTarget(
  explicit: PointerBindTarget | undefined,
  resolved: readonly unknown[],
): PointerBindTarget {
  if (explicit) return explicit
  const first = resolved[0]
  if (!first) {
    throw new Error("gesture: no target element resolved and no opts.target provided")
  }
  return first as PointerBindTarget
}

function drag(animated: GestureTarget, opts: DragPublicOpts = {}): DragHandle {
  const { target, resolve, ...rest } = opts
  const playOpts: PlayOpts = resolve ? { resolve } : {}
  const targets = resolveTargets(animated, playOpts)
  const pointerTarget = pickPointerTarget(target, targets)
  return playDrag(targets, { ...rest, target: pointerTarget })
}

function hover(animated: GestureTarget, opts: HoverPublicOpts): HoverHandle {
  const { target, resolve, ...rest } = opts
  const playOpts: PlayOpts = resolve ? { resolve } : {}
  const targets = resolveTargets(animated, playOpts)
  const pointerTarget = pickPointerTarget(target, targets)
  return playHover(targets, { ...rest, target: pointerTarget })
}

export const gesture = { drag, hover }

export type { DragHandle, HoverHandle }
