/**
 * Hover gesture driver.
 *
 * Binds `pointerenter` and `pointerleave` on a single element; each
 * transition plays an `AnimationDef` on the given targets. The two
 * directions own independent `Controls`, so re-entering while the leave
 * animation is still running cancels the leave and starts a fresh enter
 * (and vice versa).
 *
 * When `leave` is omitted, `enter` is played forward on pointerenter and
 * reversed on pointerleave, so a single definition can drive both
 * directions.
 */

import type { Controls } from "../api/controls"
import { play } from "../api/play"
import type { AnimationDef } from "../core/types"
import type { AnimationProps, StrategyOpts, StrategyTarget } from "../render/strategy"
import type { PointerBindTarget } from "./pointer"

export type HoverState = "idle" | "active" | "cancelled"

export interface HoverHandle {
  cancel(): void
  readonly state: HoverState
  /** `true` while the pointer is over the target. */
  readonly isHovering: boolean
}

export interface HoverOpts extends StrategyOpts {
  readonly target: PointerBindTarget
  /** Animation played on pointerenter. */
  readonly enter: AnimationDef<AnimationProps>
  /**
   * Animation played on pointerleave. If omitted, the `enter` animation
   * is reversed instead.
   */
  readonly leave?: AnimationDef<AnimationProps>
}

export function playHover(targets: readonly StrategyTarget[], opts: HoverOpts): HoverHandle {
  let state: HoverState = "idle"
  let isHovering = false
  let current: Controls | null = null

  const { target, enter, leave, ...strategyOpts } = opts

  const playOpts = strategyOpts as StrategyOpts

  const startEnter = (): void => {
    current?.cancel()
    current = play(enter, targets, playOpts)
    state = "active"
  }

  const startLeave = (): void => {
    current?.cancel()
    if (leave) {
      current = play(leave, targets, playOpts)
    } else {
      const c = play(enter, targets, playOpts)
      c.reverse()
      current = c
    }
    state = "active"
  }

  const onEnter = (_ev: unknown): void => {
    if (state === "cancelled") return
    isHovering = true
    startEnter()
  }

  const onLeave = (_ev: unknown): void => {
    if (state === "cancelled") return
    isHovering = false
    startLeave()
  }

  type Listener = Parameters<PointerBindTarget["addEventListener"]>[1]
  target.addEventListener("pointerenter", onEnter as unknown as Listener)
  target.addEventListener("pointerleave", onLeave as unknown as Listener)

  return {
    cancel() {
      if (state === "cancelled") return
      state = "cancelled"
      current?.cancel()
      current = null
      target.removeEventListener("pointerenter", onEnter as unknown as Listener)
      target.removeEventListener("pointerleave", onLeave as unknown as Listener)
    },
    get state() {
      return state
    },
    get isHovering() {
      return isHovering
    },
  }
}
