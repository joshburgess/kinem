/**
 * `createGesture` binds `drag` and/or `hover` gesture drivers to a
 * Solid ref. Options are latched on bind. Use `cancel()` to detach
 * without unmounting; `onCleanup` cancels any active gesture
 * automatically.
 */

import {
  type DragHandle,
  type DragPublicOpts,
  type HoverHandle,
  type HoverPublicOpts,
  type StrategyTarget,
  gesture,
} from "@kinem/core"
import { onCleanup } from "solid-js"

export interface CreateGestureOpts {
  readonly drag?: DragPublicOpts
  readonly hover?: HoverPublicOpts
}

export interface CreateGestureResult<T extends Element = Element> {
  ref(el: T): void
  /** Active drag handle, or `null` if no drag is configured or bound. */
  readonly drag: DragHandle | null
  /** Active hover handle, or `null` if no hover is configured or bound. */
  readonly hover: HoverHandle | null
  /** Cancel all bound gestures. Safe to call multiple times. */
  cancel(): void
}

export function createGesture<T extends Element = Element>(
  opts: CreateGestureOpts,
): CreateGestureResult<T> {
  let el: T | null = null
  let dragHandle: DragHandle | null = null
  let hoverHandle: HoverHandle | null = null

  const unbind = (): void => {
    dragHandle?.cancel()
    hoverHandle?.cancel()
    dragHandle = null
    hoverHandle = null
  }

  const bind = (node: T): void => {
    unbind()
    const strategyEl = node as unknown as StrategyTarget
    if (opts.drag) dragHandle = gesture.drag([strategyEl], opts.drag)
    if (opts.hover) hoverHandle = gesture.hover([strategyEl], opts.hover)
  }

  onCleanup(() => {
    unbind()
    el = null
  })

  return {
    ref(node) {
      el = node
      if (node) bind(node)
    },
    get drag() {
      return dragHandle
    },
    get hover() {
      return hoverHandle
    },
    cancel() {
      unbind()
    },
  }
}
