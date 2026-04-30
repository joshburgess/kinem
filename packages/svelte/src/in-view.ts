/**
 * `inView` is a Svelte action that emits a custom `inviewchange` event
 * on the host element when its viewport intersection changes. It also
 * accepts callbacks via the action parameters for direct hooking
 * without a CustomEvent.
 *
 *   <div use:inView={{ amount: "all", once: true, onEnter, onLeave }}>
 *     ...
 *   </div>
 */

import {
  type InViewEntry,
  type InViewOpts,
  type InViewStop,
  inView as coreInView,
} from "@kinem/core"

export interface InViewActionOpts extends InViewOpts {
  readonly onEnter?: (entry: InViewEntry) => void
  readonly onLeave?: (entry: InViewEntry | null) => void
}

export interface InViewActionReturn {
  update(opts: InViewActionOpts): void
  destroy(): void
}

export function inView(node: Element, opts: InViewActionOpts = {}): InViewActionReturn {
  let current = opts
  let stop: InViewStop | null = null

  const start = (): void => {
    stop = coreInView(
      node,
      (entry) => {
        node.dispatchEvent(new CustomEvent("inviewchange", { detail: { inView: true, entry } }))
        current.onEnter?.(entry)
        return (leaveEntry) => {
          node.dispatchEvent(
            new CustomEvent("inviewchange", { detail: { inView: false, entry: leaveEntry } }),
          )
          current.onLeave?.(leaveEntry)
        }
      },
      current,
    )
  }

  start()

  return {
    update(next: InViewActionOpts): void {
      current = next
      stop?.()
      stop = null
      start()
    },
    destroy(): void {
      stop?.()
      stop = null
    },
  }
}
