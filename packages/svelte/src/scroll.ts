/**
 * `scroll` is a Svelte action that binds a vanilla `scroll()` driver to
 * the host element. Use for scroll-linked or scroll-triggered animations
 * with the same option shape as `@kinem/core`'s `scroll()`.
 *
 *   <div use:scroll={{
 *     def: tween({ opacity: [0, 1] }, { duration: 400 }),
 *     opts: { sync: true, trigger: { start: "top 80%", end: "top 20%" } },
 *   }} />
 *
 * The action latches `opts` on bind. Updates that change `def` cancel the
 * existing driver and start a new one; updates that only change `opts`
 * are ignored to keep behaviour predictable. Destroy cancels the active
 * driver.
 */

import type {
  AnimationDef,
  AnimationProps,
  ScrollHandle,
  ScrollOpts,
  StrategyTarget,
} from "@kinem/core"
import { scroll as scrollDriver } from "@kinem/core"

export interface ScrollActionOpts {
  readonly def: AnimationDef<AnimationProps>
  readonly opts?: ScrollOpts
}

export interface ScrollActionReturn {
  update(next: ScrollActionOpts): void
  destroy(): void
}

export function scroll(node: Element, params: ScrollActionOpts): ScrollActionReturn {
  let currentDef = params.def
  let handle: ScrollHandle | null = scrollDriver(
    currentDef,
    [node as unknown as StrategyTarget],
    params.opts ?? {},
  )

  return {
    update(next) {
      if (next.def === currentDef) return
      handle?.cancel()
      currentDef = next.def
      handle = scrollDriver(currentDef, [node as unknown as StrategyTarget], next.opts ?? {})
    },
    destroy() {
      handle?.cancel()
      handle = null
    },
  }
}
