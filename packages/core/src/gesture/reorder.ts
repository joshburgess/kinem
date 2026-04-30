/**
 * `createReorderController()` is the framework-agnostic engine behind
 * the `Reorder` UI in each adapter. The controller holds a map of
 * `value -> HTMLElement` registrations, a current ordered list of
 * values (mirrored from the parent on every render), and starts a
 * drag session on demand.
 *
 * A drag session snapshots the rects of every registered item, then
 * for each pointer move:
 *  - translates the dragged element to follow the pointer along `axis`,
 *  - re-derives a new order by checking which neighbour's center the
 *    dragged item's projected center crossed,
 *  - translates non-dragged siblings by ±draggedSize to make room.
 *
 * On end, the dragged transform clears, sibling transforms clear, and
 * if the order differs from the original `values` snapshot the new
 * order is committed via `commit(next)`. Adapters wire DOM pointer
 * events and the `commit` callback; they never touch the rect / sort
 * math themselves.
 */

export type ReorderAxis = "x" | "y"

export interface ReorderDragSession {
  move(clientCoord: number): void
  end(): void
  cancel(): void
}

export interface ReorderControllerOpts<T> {
  readonly axis: ReorderAxis
  /** Snapshot of the current ordered values (reads only, on each drag start). */
  readonly getValues: () => readonly T[]
  /** Called once when the drag-final order differs from the snapshot at start. */
  readonly commit: (next: T[]) => void
}

export interface ReorderController<T> {
  readonly axis: ReorderAxis
  registerItem(value: T, el: HTMLElement | null): void
  startDrag(value: T, _pointerId: number, clientCoord: number): ReorderDragSession | null
  /** Tear down: clear registrations. Existing sessions are not cancelled. */
  destroy(): void
}

const getRectExtent = (rect: DOMRect, axis: ReorderAxis): { start: number; size: number } => {
  if (axis === "y") return { start: rect.top, size: rect.height }
  return { start: rect.left, size: rect.width }
}

const applyTranslate = (el: HTMLElement, axis: ReorderAxis, delta: number): void => {
  el.style.transform =
    axis === "y" ? `translate3d(0, ${delta}px, 0)` : `translate3d(${delta}px, 0, 0)`
}

const clearTranslate = (el: HTMLElement): void => {
  el.style.transform = ""
}

const arraysEqual = <T>(a: readonly T[], b: readonly T[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function createReorderController<T>(opts: ReorderControllerOpts<T>): ReorderController<T> {
  const { axis, getValues, commit } = opts
  const items = new Map<T, HTMLElement>()

  return {
    axis,
    registerItem(value: T, el: HTMLElement | null): void {
      if (el) items.set(value, el)
      else items.delete(value)
    },
    startDrag(value: T, _pointerId: number, clientCoord: number): ReorderDragSession | null {
      const draggedEl = items.get(value)
      if (!draggedEl) return null
      const rects = new Map<T, { start: number; size: number }>()
      for (const [v, el] of items) {
        rects.set(v, getRectExtent(el.getBoundingClientRect(), axis))
      }
      const draggedRect = rects.get(value)
      if (!draggedRect) return null
      const draggedCenterStart = draggedRect.start + draggedRect.size / 2
      const pointerStart = clientCoord
      const initialValues = getValues()
      let order: T[] = [...initialValues]
      const movedSiblings = new Set<HTMLElement>()
      draggedEl.style.zIndex = "1"
      draggedEl.style.willChange = "transform"

      const indexInInitial = new Map<T, number>()
      initialValues.forEach((v, i) => indexInInitial.set(v, i))
      const othersInInitialOrder = initialValues.filter((v) => v !== value)

      const computeNewOrder = (pointerCoord: number): T[] => {
        const draggedCenter = draggedCenterStart + (pointerCoord - pointerStart)
        let inserted = false
        const next: T[] = []
        for (const o of othersInInitialOrder) {
          const r = rects.get(o)
          if (!r) continue
          const center = r.start + r.size / 2
          if (!inserted && draggedCenter < center) {
            next.push(value)
            inserted = true
          }
          next.push(o)
        }
        if (!inserted) next.push(value)
        return next
      }

      const applySiblingShifts = (next: T[]): void => {
        const indexInNext = new Map<T, number>()
        next.forEach((v, i) => indexInNext.set(v, i))
        const draggedSize = rects.get(value)?.size ?? 0
        for (const [v, el] of items) {
          if (v === value) continue
          const initIdx = indexInInitial.get(v)
          const newIdx = indexInNext.get(v)
          if (initIdx === undefined || newIdx === undefined) continue
          const delta = newIdx - initIdx
          if (delta === 0) {
            if (movedSiblings.has(el)) {
              clearTranslate(el)
              movedSiblings.delete(el)
            }
            continue
          }
          const shift = delta * draggedSize
          applyTranslate(el, axis, shift)
          movedSiblings.add(el)
        }
      }

      const reset = (): void => {
        for (const el of movedSiblings) clearTranslate(el)
        movedSiblings.clear()
        clearTranslate(draggedEl)
        draggedEl.style.zIndex = ""
        draggedEl.style.willChange = ""
      }

      return {
        move(coord: number): void {
          const offset = coord - pointerStart
          applyTranslate(draggedEl, axis, offset)
          const next = computeNewOrder(coord)
          if (!arraysEqual(next, order)) {
            order = next
            applySiblingShifts(next)
          }
        },
        end(): void {
          reset()
          if (!arraysEqual(order, initialValues)) commit(order)
        },
        cancel(): void {
          reset()
        },
      }
    },
    destroy(): void {
      items.clear()
    },
  }
}
