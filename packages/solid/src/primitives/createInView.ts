/**
 * `createInView(opts)` returns `{ ref, inView }`. The `ref` is a Solid
 * ref setter (pass to `<div ref={result.ref}>`) and `inView` is an
 * `Accessor<boolean>` that flips on viewport intersection enter/leave.
 */

import { type InViewEntry, type InViewOpts, type InViewStop, inView } from "@kinem/core"
import { type Accessor, createSignal, onCleanup } from "solid-js"

export interface CreateInViewOpts extends InViewOpts {
  readonly onEnter?: (entry: InViewEntry) => undefined | (() => void)
}

export interface CreateInViewResult<T extends Element = Element> {
  readonly ref: (el: T | null) => void
  readonly inView: Accessor<boolean>
}

export function createInView<T extends Element = Element>(
  opts: CreateInViewOpts = {},
): CreateInViewResult<T> {
  const [visible, setVisible] = createSignal(false)
  let stop: InViewStop | null = null
  let current: T | null = null

  const detach = (): void => {
    if (stop) {
      stop()
      stop = null
    }
  }

  const ref = (el: T | null): void => {
    if (el === current) return
    detach()
    current = el
    if (!el) return
    stop = inView(
      el,
      (entry) => {
        setVisible(true)
        const userLeave = opts.onEnter?.(entry)
        return () => {
          setVisible(false)
          if (typeof userLeave === "function") userLeave()
        }
      },
      opts,
    )
  }

  onCleanup(detach)

  return { ref, inView: visible }
}
