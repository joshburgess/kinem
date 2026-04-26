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

import { KinemError } from "../core/errors"
import type { DragHandle, DragOpts } from "../gesture/drag"
import { playDrag } from "../gesture/drag"
import type { HoverHandle, HoverOpts } from "../gesture/hover"
import { playHover } from "../gesture/hover"
import type { PointerBindTarget } from "../gesture/pointer"
import type {
  PanHandle,
  PanOpts,
  PinchHandle,
  PinchOpts,
  PressHandle,
  PressOpts,
  TapHandle,
  TapOpts,
} from "../gesture/recognizers"
import { playPan, playPinch, playPress, playTap } from "../gesture/recognizers"
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

export type TapPublicOpts = Omit<TapOpts, "target"> & {
  readonly target?: PointerBindTarget
  readonly resolve?: PlayOpts["resolve"]
}

export type PressPublicOpts = Omit<PressOpts, "target"> & {
  readonly target?: PointerBindTarget
  readonly resolve?: PlayOpts["resolve"]
}

export type PanPublicOpts = Omit<PanOpts, "target"> & {
  readonly target?: PointerBindTarget
  readonly resolve?: PlayOpts["resolve"]
}

export type PinchPublicOpts = Omit<PinchOpts, "target"> & {
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
    throw new KinemError(
      "gesture: no target element resolved",
      "pass an element/selector or provide opts.target explicitly",
    )
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

function tap(animated: GestureTarget, opts: TapPublicOpts = {}): TapHandle {
  const { target, resolve, ...rest } = opts
  const playOpts: PlayOpts = resolve ? { resolve } : {}
  const targets = resolveTargets(animated, playOpts)
  const pointerTarget = pickPointerTarget(target, targets)
  return playTap({ ...rest, target: pointerTarget })
}

function press(animated: GestureTarget, opts: PressPublicOpts = {}): PressHandle {
  const { target, resolve, ...rest } = opts
  const playOpts: PlayOpts = resolve ? { resolve } : {}
  const targets = resolveTargets(animated, playOpts)
  const pointerTarget = pickPointerTarget(target, targets)
  return playPress({ ...rest, target: pointerTarget })
}

function pan(animated: GestureTarget, opts: PanPublicOpts = {}): PanHandle {
  const { target, resolve, ...rest } = opts
  const playOpts: PlayOpts = resolve ? { resolve } : {}
  const targets = resolveTargets(animated, playOpts)
  const pointerTarget = pickPointerTarget(target, targets)
  return playPan({ ...rest, target: pointerTarget })
}

function pinch(animated: GestureTarget, opts: PinchPublicOpts = {}): PinchHandle {
  const { target, resolve, ...rest } = opts
  const playOpts: PlayOpts = resolve ? { resolve } : {}
  const targets = resolveTargets(animated, playOpts)
  const pointerTarget = pickPointerTarget(target, targets)
  return playPinch({ ...rest, target: pointerTarget })
}

export const gesture = { drag, hover, tap, press, pan, pinch }

export type { DragHandle, HoverHandle, PanHandle, PinchHandle, PressHandle, TapHandle }
