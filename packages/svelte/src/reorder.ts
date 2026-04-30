/**
 * `reorderGroup` and `reorderItem` are Svelte actions that turn a
 * parent + children into a drag-to-sort list. The parent owns the
 * `values` array and an `onReorder` callback; each item registers
 * itself with the group, becomes draggable along the group's `axis`,
 * and asks the group to commit a new order whenever the dragged item's
 * center crosses a neighbour's. Sibling translates are applied
 * mid-drag and cleared on pointer release; the new order is committed
 * if it differs from the snapshot at drag start.
 *
 *   <script lang="ts">
 *     import { reorderGroup, reorderItem } from "@kinem/svelte"
 *     let items = ["a", "b", "c"]
 *   </script>
 *
 *   <ul use:reorderGroup={{ values: items, onReorder: (n) => items = n }}>
 *     {#each items as v (v)}
 *       <li use:reorderItem={{ value: v }}>{v}</li>
 *     {/each}
 *   </ul>
 *
 * The parent's `use:reorderGroup` MUST be attached before children
 * mount; Svelte's mount order (parent before child actions) makes this
 * the natural arrangement.
 */

import {
  type ReorderAxis,
  type ReorderController,
  type ReorderDragSession,
  createReorderController,
} from "@kinem/core"

export type { ReorderAxis }

export interface ReorderGroupActionOpts<T> {
  readonly values: readonly T[]
  readonly onReorder: (next: T[]) => void
  readonly axis?: ReorderAxis
}

export interface ReorderGroupActionReturn<T> {
  update(opts: ReorderGroupActionOpts<T>): void
  destroy(): void
}

export interface ReorderItemActionOpts<T> {
  readonly value: T
  readonly idleCursor?: string
}

export interface ReorderItemActionReturn<T> {
  update(opts: ReorderItemActionOpts<T>): void
  destroy(): void
}

/**
 * Per-element registry of group controllers. We use a WeakMap rather
 * than mutating a property on the DOM node so we don't have to worry
 * about TypeScript's `exactOptionalPropertyTypes` and so the entry
 * disappears if the element is garbage-collected.
 */
const groupCtrls = new WeakMap<Element, ReorderController<unknown>>()

/**
 * `findGroupCtrl(node)` walks up the DOM ancestors looking for an
 * element that has a controller registered by `reorderGroup`. We use a
 * DOM-side lookup instead of Svelte's `getContext` so the action works
 * regardless of whether the parent and children share a Svelte
 * component scope.
 */
const findGroupCtrl = <T>(node: Element): ReorderController<T> | null => {
  let cur: Element | null = node.parentElement
  while (cur) {
    const ctrl = groupCtrls.get(cur)
    if (ctrl) return ctrl as ReorderController<T>
    cur = cur.parentElement
  }
  return null
}

export function reorderGroup<T>(
  node: Element,
  opts: ReorderGroupActionOpts<T>,
): ReorderGroupActionReturn<T> {
  let current = opts
  const ctrl = createReorderController<T>({
    axis: current.axis ?? "y",
    getValues: () => current.values,
    commit: (next) => current.onReorder(next),
  })
  groupCtrls.set(node, ctrl as ReorderController<unknown>)

  return {
    update(next: ReorderGroupActionOpts<T>): void {
      current = next
    },
    destroy(): void {
      groupCtrls.delete(node)
      ctrl.destroy()
    },
  }
}

export function reorderItem<T>(
  node: Element,
  opts: ReorderItemActionOpts<T>,
): ReorderItemActionReturn<T> {
  const ctx = findGroupCtrl<T>(node)
  if (!ctx) {
    throw new Error("reorderItem must be applied inside an element using reorderGroup")
  }
  let current = opts
  let session: ReorderDragSession | null = null
  const el = node as HTMLElement
  ctx.registerItem(current.value, el)

  el.style.cursor = current.idleCursor ?? "grab"
  el.style.touchAction = ctx.axis === "y" ? "pan-x" : "pan-y"

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== undefined && e.button !== 0) return
    const coord = ctx.axis === "y" ? e.clientY : e.clientX
    const next = ctx.startDrag(current.value, e.pointerId, coord)
    if (!next) return
    session = next
    try {
      el.setPointerCapture(e.pointerId)
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
      el.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  el.addEventListener("pointerdown", onPointerDown)
  el.addEventListener("pointermove", onPointerMove)
  el.addEventListener("pointerup", finish)
  el.addEventListener("pointercancel", finish)

  return {
    update(next: ReorderItemActionOpts<T>): void {
      if (next.value !== current.value) {
        ctx.registerItem(current.value, null)
        ctx.registerItem(next.value, el)
      }
      if (next.idleCursor !== current.idleCursor) {
        el.style.cursor = next.idleCursor ?? "grab"
      }
      current = next
    },
    destroy(): void {
      ctx.registerItem(current.value, null)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", finish)
      el.removeEventListener("pointercancel", finish)
      if (session) {
        session.cancel()
        session = null
      }
    },
  }
}
