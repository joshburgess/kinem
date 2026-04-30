/**
 * `<ReorderGroup>` and `<ReorderItem>` provide a drag-to-sort list. The
 * group owns the `values` array and an `onReorder` callback; each item
 * registers itself with the group, becomes draggable along the group's
 * `axis`, and asks the group to commit a new order whenever the
 * dragged item's center crosses a neighbour's. Sibling translates are
 * applied mid-drag; pointer release commits and clears them.
 *
 *   <ReorderGroup axis="y" :values="items" @reorder="setItems">
 *     <ReorderItem v-for="item in items" :key="item.id" :value="item">
 *       {{ item.label }}
 *     </ReorderItem>
 *   </ReorderGroup>
 */

import {
  type ReorderAxis,
  type ReorderController,
  type ReorderDragSession,
  createReorderController,
} from "@kinem/core"
import {
  type CSSProperties,
  type Component,
  type PropType,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
} from "vue"
import { ReorderKey } from "./reorder-context"

export type { ReorderAxis }

export const ReorderGroup = defineComponent({
  name: "ReorderGroup",
  inheritAttrs: false,
  props: {
    values: { type: Array as PropType<readonly unknown[]>, required: true },
    onReorder: { type: Function as PropType<(next: unknown[]) => void>, required: true },
    axis: { type: String as PropType<ReorderAxis>, default: "y" },
    as: { type: String, default: "ul" },
  },
  setup(props, { slots, attrs }) {
    const ctrl = createReorderController<unknown>({
      axis: props.axis,
      getValues: () => props.values,
      commit: (next) => props.onReorder(next),
    })
    provide(ReorderKey, ctrl)
    onBeforeUnmount(() => {
      ctrl.destroy()
    })
    return () => h(props.as, { ...attrs }, slots["default"]?.())
  },
})

export const ReorderItem: Component = defineComponent({
  name: "ReorderItem",
  inheritAttrs: false,
  props: {
    value: { type: null as unknown as PropType<unknown>, required: true },
    as: { type: String, default: "li" },
    idleCursor: { type: String as PropType<CSSProperties["cursor"]>, default: "grab" },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(ReorderKey, null) as ReorderController<unknown> | null
    if (!ctx) {
      throw new Error("ReorderItem must be rendered inside a ReorderGroup")
    }
    const elRef = shallowRef<HTMLElement | null>(null)
    let session: ReorderDragSession | null = null

    onMounted(() => {
      if (elRef.value) ctx.registerItem(props.value, elRef.value)
    })
    onBeforeUnmount(() => {
      ctx.registerItem(props.value, null)
      if (session) {
        session.cancel()
        session = null
      }
    })

    const onPointerdown = (e: PointerEvent): void => {
      if (e.button !== undefined && e.button !== 0) return
      const target = e.currentTarget as HTMLElement | null
      if (!target) return
      const coord = ctx.axis === "y" ? e.clientY : e.clientX
      const next = ctx.startDrag(props.value, e.pointerId, coord)
      if (!next) return
      session = next
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      e.preventDefault()
    }
    const onPointermove = (e: PointerEvent): void => {
      if (!session) return
      const coord = ctx.axis === "y" ? e.clientY : e.clientX
      session.move(coord)
    }
    const finish = (e: PointerEvent): void => {
      if (!session) return
      const s = session
      session = null
      s.end()
      try {
        ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    return () => {
      const mergedStyle: CSSProperties = {
        cursor: props.idleCursor,
        touchAction: ctx.axis === "y" ? "pan-x" : "pan-y",
        ...((attrs.style as CSSProperties | undefined) ?? {}),
      }
      const { style: _omit, ...restAttrs } = attrs as Record<string, unknown>
      return h(
        props.as,
        {
          ref: (el: unknown) => {
            elRef.value = el as HTMLElement | null
          },
          style: mergedStyle,
          onPointerdown,
          onPointermove,
          onPointerup: finish,
          onPointercancel: finish,
          ...restAttrs,
        },
        slots["default"]?.(),
      )
    }
  },
})
