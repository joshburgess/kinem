/**
 * `ReorderGroup` and `ReorderItem` provide a drag-to-sort list. The
 * group owns the `values` array and an `onReorder` callback; each item
 * registers itself with the group, becomes draggable along the group's
 * `axis`, and asks the group to commit a new order whenever the
 * dragged item's center crosses a neighbour's. Sibling translates are
 * applied mid-drag; pointer release commits and clears them.
 *
 *   <ReorderGroup axis="y" values={items()} onReorder={setItems}>
 *     <For each={items()}>{(item) => (
 *       <ReorderItem value={item}>{item.label}</ReorderItem>
 *     )}</For>
 *   </ReorderGroup>
 */

import {
  type ReorderAxis,
  type ReorderController,
  type ReorderDragSession,
  createReorderController,
} from "@kinem/core"
import { type JSX, createMemo, onCleanup, useContext } from "solid-js"
import h from "solid-js/h"
import { ReorderContext } from "./reorder-context"

export type { ReorderAxis }

export interface ReorderGroupProps<T> {
  values: readonly T[]
  onReorder: (next: T[]) => void
  axis?: ReorderAxis
  as?: string
  children?: JSX.Element
  style?: JSX.CSSProperties
}

export interface ReorderItemProps<T> {
  value: T
  as?: string
  children?: JSX.Element
  style?: JSX.CSSProperties
  /** Cursor style applied while idle. Defaults to `grab`. */
  idleCursor?: JSX.CSSProperties["cursor"]
}

export function ReorderGroup<T>(props: ReorderGroupProps<T>): JSX.Element {
  const ctrl = createReorderController<T>({
    axis: props.axis ?? "y",
    getValues: () => props.values,
    commit: (next) => props.onReorder(next),
  })
  onCleanup(() => ctrl.destroy())

  const provide = createMemo(() => ctrl as ReorderController<unknown>)
  const tag = props.as ?? "ul"
  const node = h(tag, { style: props.style }, props.children as unknown) as unknown as JSX.Element

  return h(ReorderContext.Provider, { value: provide }, node) as unknown as JSX.Element
}

export function ReorderItem<T>(props: ReorderItemProps<T>): JSX.Element {
  const ctxAccessor = useContext(ReorderContext)
  const ctx = ctxAccessor() as ReorderController<T> | null
  if (!ctx) {
    throw new Error("ReorderItem must be rendered inside a ReorderGroup")
  }
  let el: HTMLElement | null = null
  let session: ReorderDragSession | null = null

  const setRef = (node: Element): void => {
    el = node as HTMLElement
    ctx.registerItem(props.value, el)
  }

  onCleanup(() => {
    if (el) ctx.registerItem(props.value, null)
    if (session) {
      session.cancel()
      session = null
    }
  })

  const onPointerDown = (e: PointerEvent): void => {
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
  const onPointerMove = (e: PointerEvent): void => {
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

  const tag = props.as ?? "li"
  const mergedStyle: JSX.CSSProperties = {
    cursor: props.idleCursor ?? "grab",
    "touch-action": ctx.axis === "y" ? "pan-x" : "pan-y",
    ...(props.style ?? {}),
  }
  return h(
    tag,
    {
      ref: setRef,
      style: mergedStyle,
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
    props.children as unknown,
  ) as unknown as JSX.Element
}
