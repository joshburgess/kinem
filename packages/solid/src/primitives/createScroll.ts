/**
 * `createScroll` binds a vanilla `scroll()` driver to a Solid ref. The
 * primitive attaches the driver as soon as the ref is populated and
 * cancels it on cleanup.
 *
 * Options are latched at bind time; to reconfigure, recreate the
 * consuming component or call `cancel()` and let the consumer rebind.
 * The primitive never writes Solid signals during scroll activity:
 * progress flows to the vanilla driver's `onProgress` callback (when
 * supplied) or `toggleActions`.
 */

import {
  type AnimationDef,
  type AnimationProps,
  type ScrollHandle,
  type ScrollOpts,
  type StrategyTarget,
  scroll,
} from "@kinem/core"
import { onCleanup } from "solid-js"

export interface CreateScrollResult<T extends Element = Element> {
  ref(el: T): void
  /** Active scroll handle, or `null` if no element is bound yet. */
  readonly handle: ScrollHandle | null
  /** Cancel the bound scroll driver. Safe to call multiple times. */
  cancel(): void
}

export function createScroll<T extends Element = Element>(
  def: AnimationDef<AnimationProps>,
  opts: ScrollOpts = {},
): CreateScrollResult<T> {
  let el: T | null = null
  let handle: ScrollHandle | null = null

  const unbind = (): void => {
    handle?.cancel()
    handle = null
  }
  const bind = (node: T): void => {
    handle = scroll(def, [node as unknown as StrategyTarget], opts)
  }

  onCleanup(() => {
    unbind()
    el = null
  })

  return {
    ref(node) {
      if (node === el) return
      unbind()
      el = node
      if (node) bind(node)
    },
    get handle() {
      return handle
    },
    cancel() {
      unbind()
    },
  }
}
