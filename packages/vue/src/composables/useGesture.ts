/**
 * `useGesture` binds vanilla `gesture` drivers (drag, hover) to a Vue
 * template ref.
 *
 *   const { ref, drag, hover } = useGesture<HTMLDivElement>({
 *     drag: { axis: "x", bounds: { left: -100, right: 100 } },
 *     hover: { enter: tween({ scale: [1, 1.1] }, { duration: 150 }) },
 *   })
 *
 * Options are latched at bind time. The composable watches the ref:
 * when it becomes non-null the drivers attach; when the ref is replaced
 * or on `onBeforeUnmount`, every active gesture is cancelled. Vue's
 * reactivity is not used to drive per-frame state; gesture updates
 * flow through the vanilla handles.
 */

import type {
  DragHandle,
  DragPublicOpts,
  HoverHandle,
  HoverPublicOpts,
  StrategyTarget,
} from "@kinem/core"
import { gesture } from "@kinem/core"
import { type ShallowRef, onBeforeUnmount, onMounted, shallowRef, watch } from "vue"

export interface UseGestureOpts {
  readonly drag?: DragPublicOpts
  readonly hover?: HoverPublicOpts
}

export interface UseGestureResult<T extends Element = Element> {
  readonly ref: ShallowRef<T | null>
  /** Active drag handle, or `null` if no drag is configured or bound. */
  readonly drag: ShallowRef<DragHandle | null>
  /** Active hover handle, or `null` if no hover is configured or bound. */
  readonly hover: ShallowRef<HoverHandle | null>
  /** Cancel all bound gestures. Safe to call multiple times. */
  cancel(): void
}

export function useGesture<T extends Element = Element>(opts: UseGestureOpts): UseGestureResult<T> {
  const elRef: ShallowRef<T | null> = shallowRef(null)
  const dragRef: ShallowRef<DragHandle | null> = shallowRef(null)
  const hoverRef: ShallowRef<HoverHandle | null> = shallowRef(null)

  const unbind = (): void => {
    dragRef.value?.cancel()
    hoverRef.value?.cancel()
    dragRef.value = null
    hoverRef.value = null
  }

  const bind = (el: T): void => {
    unbind()
    const strategyEl = el as unknown as StrategyTarget
    if (opts.drag) dragRef.value = gesture.drag([strategyEl], opts.drag)
    if (opts.hover) hoverRef.value = gesture.hover([strategyEl], opts.hover)
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
    drag: dragRef,
    hover: hoverRef,
    cancel: unbind,
  }
}
