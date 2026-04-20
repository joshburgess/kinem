/**
 * `useScroll` binds a vanilla `scroll()` driver to a Vue template ref.
 *
 *   const { ref, handle } = useScroll<HTMLElement>(
 *     tween({ opacity: [0, 1] }, { duration: 400 }),
 *     { sync: true, trigger: { start: "top 80%", end: "top 20%" } },
 *   )
 *
 * The composable watches the ref: when it becomes non-null the driver is
 * attached; when the ref is replaced or on `onBeforeUnmount`, the driver
 * is cancelled. Options are latched at bind time.
 */

import type {
  AnimationDef,
  AnimationProps,
  ScrollHandle,
  ScrollOpts,
  StrategyTarget,
} from "@kinem/core"
import { scroll } from "@kinem/core"
import { type ShallowRef, onBeforeUnmount, onMounted, shallowRef, watch } from "vue"

export interface UseScrollResult<T extends Element = Element> {
  readonly ref: ShallowRef<T | null>
  /** Active scroll handle, or `null` if no element is bound yet. */
  readonly handle: ShallowRef<ScrollHandle | null>
  /** Cancel the bound scroll driver. Safe to call multiple times. */
  cancel(): void
}

export function useScroll<T extends Element = Element>(
  def: AnimationDef<AnimationProps>,
  opts: ScrollOpts = {},
): UseScrollResult<T> {
  const elRef: ShallowRef<T | null> = shallowRef(null)
  const handleRef: ShallowRef<ScrollHandle | null> = shallowRef(null)

  const unbind = (): void => {
    handleRef.value?.cancel()
    handleRef.value = null
  }

  const bind = (el: T): void => {
    unbind()
    handleRef.value = scroll(def, [el as unknown as StrategyTarget], opts)
  }

  onMounted(() => {
    const el = elRef.value
    if (el) bind(el)
  })

  watch(elRef, (el) => {
    unbind()
    if (el) bind(el)
  })

  onBeforeUnmount(() => {
    unbind()
  })

  return {
    ref: elRef,
    handle: handleRef,
    cancel() {
      unbind()
    },
  }
}
