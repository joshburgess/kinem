/**
 * `useInView(opts)` returns `{ ref, inView }`. The `ref` is a Vue
 * `Ref<Element | null>` to bind via `v-bind:ref` (template ref syntax).
 * The `inView` ref flips on intersection enter/leave.
 */

import { type InViewEntry, type InViewOpts, type InViewStop, inView } from "@kinem/core"
import { type Ref, onBeforeUnmount, ref, watch } from "vue"

export interface UseInViewOpts extends InViewOpts {
  readonly onEnter?: (entry: InViewEntry) => undefined | (() => void)
}

export interface UseInViewResult<T extends Element = Element> {
  readonly elRef: Ref<T | null>
  readonly inView: Ref<boolean>
}

export function useInView<T extends Element = Element>(
  opts: UseInViewOpts = {},
): UseInViewResult<T> {
  const elRef = ref<T | null>(null) as Ref<T | null>
  const visible = ref(false)
  let stop: InViewStop | null = null

  const detach = (): void => {
    if (stop) {
      stop()
      stop = null
    }
  }

  watch(elRef, (el, _prev, onCleanup) => {
    detach()
    if (!el) return
    stop = inView(
      el,
      (entry) => {
        visible.value = true
        const userLeave = opts.onEnter?.(entry)
        return () => {
          visible.value = false
          if (typeof userLeave === "function") userLeave()
        }
      },
      opts,
    )
    onCleanup(detach)
  })

  onBeforeUnmount(detach)

  return { elRef, inView: visible }
}
