/**
 * `gesture` is a Svelte action that binds vanilla `gesture` drivers
 * (drag, hover) to the host element.
 *
 *   <div use:gesture={{
 *     drag: { axis: "x", bounds: { left: -100, right: 100 } },
 *     hover: { enter: tween({ scale: [1, 1.1] }, { duration: 150 }) },
 *   }} />
 *
 * Options are latched on bind. Updates that only tweak the option shape
 * are ignored — to reconfigure, recreate the host element or call
 * `cancel()` and let the consumer rebind. Destroy cancels every active
 * gesture.
 */

import type {
  DragHandle,
  DragPublicOpts,
  HoverHandle,
  HoverPublicOpts,
  StrategyTarget,
} from "@kinem/core"
import { gesture as gestureDrivers } from "@kinem/core"

export interface GestureActionOpts {
  readonly drag?: DragPublicOpts
  readonly hover?: HoverPublicOpts
}

export interface GestureActionReturn {
  update(next: GestureActionOpts): void
  destroy(): void
  /** Cancel every active gesture without destroying. Safe to call multiple times. */
  cancel(): void
}

export function gesture(node: Element, params: GestureActionOpts = {}): GestureActionReturn {
  let dragH: DragHandle | null = null
  let hoverH: HoverHandle | null = null
  const strategyEl = node as unknown as StrategyTarget

  const cancel = (): void => {
    dragH?.cancel()
    hoverH?.cancel()
    dragH = null
    hoverH = null
  }

  const bind = (opts: GestureActionOpts): void => {
    if (opts.drag) dragH = gestureDrivers.drag([strategyEl], opts.drag)
    if (opts.hover) hoverH = gestureDrivers.hover([strategyEl], opts.hover)
  }

  bind(params)

  return {
    update(next) {
      cancel()
      bind(next)
    },
    destroy() {
      cancel()
    },
    cancel,
  }
}
