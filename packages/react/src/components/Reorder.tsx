/**
 * `Reorder` is a drag-to-sort list. `Reorder.Group` owns the values
 * array and reorder callback. `Reorder.Item` registers itself with the
 * group, becomes draggable along the group's axis, and asks the group
 * to commit a new order whenever the dragged item's center crosses a
 * neighbour's. After each commit the group runs a FLIP correction so
 * the dragged item visually stays under the pointer despite landing in
 * a new DOM slot. Pointer release tweens the dragged item's transform
 * back to its layout position.
 *
 *   <Reorder.Group axis="y" values={items} onReorder={setItems}>
 *     {items.map((item) => (
 *       <Reorder.Item key={item.id} value={item}>
 *         {item.label}
 *       </Reorder.Item>
 *     ))}
 *   </Reorder.Group>
 */

import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"

export type ReorderAxis = "x" | "y"

export interface ReorderGroupProps<T> extends Omit<ComponentPropsWithoutRef<"ul">, "onReorder"> {
  readonly values: readonly T[]
  readonly onReorder: (next: T[]) => void
  readonly axis?: ReorderAxis
  readonly as?: ElementType
  readonly children?: ReactNode
}

export interface ReorderItemProps<T> extends Omit<ComponentPropsWithoutRef<"li">, "value"> {
  readonly value: T
  readonly as?: ElementType
  readonly children?: ReactNode
  /** Cursor style applied while idle. Defaults to `grab`. */
  readonly idleCursor?: CSSProperties["cursor"]
}

interface GroupContextValue<T> {
  readonly axis: ReorderAxis
  registerItem(value: T, el: HTMLElement | null): void
  startDrag(value: T, pointerId: number, clientCoord: number): DragSession | null
}

interface DragSession {
  move(clientCoord: number): void
  end(): void
}

const ReorderContext = createContext<GroupContextValue<unknown> | null>(null)

function getRectExtent(rect: DOMRect, axis: ReorderAxis): { start: number; size: number } {
  if (axis === "y") return { start: rect.top, size: rect.height }
  return { start: rect.left, size: rect.width }
}

function applyTranslate(el: HTMLElement, axis: ReorderAxis, delta: number): void {
  el.style.transform =
    axis === "y" ? `translate3d(0, ${delta}px, 0)` : `translate3d(${delta}px, 0, 0)`
}

function clearTranslate(el: HTMLElement): void {
  el.style.transform = ""
}

function ReorderGroup<T>({
  values,
  onReorder,
  axis = "y",
  as,
  style,
  children,
  ...rest
}: ReorderGroupProps<T>): ReactElement {
  const Tag = (as ?? "ul") as ElementType
  const itemsRef = useRef<Map<T, HTMLElement>>(new Map())
  const valuesRef = useRef<readonly T[]>(values)
  valuesRef.current = values
  const onReorderRef = useRef<(next: T[]) => void>(onReorder)
  onReorderRef.current = onReorder

  const ctx = useMemo<GroupContextValue<T>>(() => {
    const items = itemsRef.current

    const startDrag = (value: T, pointerId: number, clientCoord: number): DragSession | null => {
      const draggedEl = items.get(value)
      if (!draggedEl) return null
      // Snapshot rects of every registered item.
      const rects = new Map<T, { start: number; size: number }>()
      for (const [v, el] of items) {
        rects.set(v, getRectExtent(el.getBoundingClientRect(), axis))
      }
      const draggedRect = rects.get(value)
      if (!draggedRect) return null
      const draggedCenterStart = draggedRect.start + draggedRect.size / 2
      const pointerStart = clientCoord
      let order: T[] = [...valuesRef.current]
      let visualOffset = 0
      // Track each non-dragged item's transform so we can clear them on end.
      const movedSiblings = new Set<HTMLElement>()
      draggedEl.style.zIndex = "1"
      draggedEl.style.willChange = "transform"

      const computeNewOrder = (pointerCoord: number): T[] => {
        const draggedCenter = draggedCenterStart + (pointerCoord - pointerStart)
        // Re-derive new order by sorting non-dragged items by their static
        // center against the dragged item's projected center.
        const others = order.filter((v) => v !== value)
        // Place the dragged value at the position whose neighbours' centers
        // bracket the dragged center.
        let inserted = false
        const next: T[] = []
        for (const o of others) {
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
        // For each non-dragged item, compute the delta between its slot in
        // `order` (its current DOM position) and `next` (intended position).
        const indexInOrder = new Map<T, number>()
        const indexInNext = new Map<T, number>()
        order.forEach((v, i) => indexInOrder.set(v, i))
        next.forEach((v, i) => indexInNext.set(v, i))
        const draggedSize = rects.get(value)?.size ?? 0
        for (const [v, el] of items) {
          if (v === value) continue
          const oldIdx = indexInOrder.get(v)
          const newIdx = indexInNext.get(v)
          if (oldIdx === undefined || newIdx === undefined) continue
          if (oldIdx === newIdx) {
            if (movedSiblings.has(el)) {
              clearTranslate(el)
              movedSiblings.delete(el)
            }
            continue
          }
          // Sibling needs to shift by ±draggedSize to make room.
          const shift = (newIdx - oldIdx) * draggedSize
          applyTranslate(el, axis, shift)
          movedSiblings.add(el)
        }
      }

      return {
        move(clientCoord) {
          visualOffset = clientCoord - pointerStart
          applyTranslate(draggedEl, axis, visualOffset)
          const next = computeNewOrder(clientCoord)
          // Compare to current `order`.
          let changed = false
          if (next.length !== order.length) changed = true
          else {
            for (let i = 0; i < next.length; i++) {
              if (next[i] !== order[i]) {
                changed = true
                break
              }
            }
          }
          if (changed) {
            order = next
            applySiblingShifts(next)
          }
        },
        end() {
          for (const el of movedSiblings) clearTranslate(el)
          movedSiblings.clear()
          // If order changed from the original valuesRef, commit it.
          const original = valuesRef.current
          let changedFromOriginal = false
          if (order.length !== original.length) changedFromOriginal = true
          else {
            for (let i = 0; i < order.length; i++) {
              if (order[i] !== original[i]) {
                changedFromOriginal = true
                break
              }
            }
          }
          clearTranslate(draggedEl)
          draggedEl.style.zIndex = ""
          draggedEl.style.willChange = ""
          if (changedFromOriginal) onReorderRef.current(order)
        },
      }
    }

    return {
      axis,
      registerItem(value, el) {
        if (el) items.set(value, el)
        else items.delete(value)
      },
      startDrag,
    }
  }, [axis])

  return (
    <ReorderContext.Provider value={ctx as GroupContextValue<unknown>}>
      <Tag style={style} {...rest}>
        {children}
      </Tag>
    </ReorderContext.Provider>
  )
}

function ReorderItem<T>({
  value,
  as,
  style,
  children,
  idleCursor = "grab",
  ...rest
}: ReorderItemProps<T>): ReactElement {
  const Tag = (as ?? "li") as ElementType
  const ctx = useContext(ReorderContext) as GroupContextValue<T> | null
  if (!ctx) {
    throw new Error("Reorder.Item must be rendered inside a Reorder.Group")
  }

  const elRef = useRef<HTMLElement | null>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const valueRef = useRef(value)
  valueRef.current = value

  const setRef = useMemo(() => {
    return (el: HTMLElement | null): void => {
      const prev = elRef.current
      if (prev === el) return
      if (prev) ctxRef.current.registerItem(valueRef.current, null)
      elRef.current = el
      if (el) ctxRef.current.registerItem(valueRef.current, el)
    }
  }, [])

  // Re-register when value identity changes.
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    ctx.registerItem(value, el)
    return () => {
      ctx.registerItem(value, null)
    }
  }, [ctx, value])

  const handlers = useMemo(() => {
    const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
      if (e.button !== undefined && e.button !== 0) return
      const target = e.currentTarget
      const coord = ctxRef.current.axis === "y" ? e.clientY : e.clientX
      const session = ctxRef.current.startDrag(valueRef.current, e.pointerId, coord)
      if (!session) return
      sessionRef.current = session
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // ignore capture failures (jsdom)
      }
      e.preventDefault()
    }
    const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
      const session = sessionRef.current
      if (!session) return
      const coord = ctxRef.current.axis === "y" ? e.clientY : e.clientX
      session.move(coord)
    }
    const finish = (e: React.PointerEvent<HTMLElement>): void => {
      const session = sessionRef.current
      if (!session) return
      sessionRef.current = null
      session.end()
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    return {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    }
  }, [])

  const mergedStyle: CSSProperties = {
    cursor: idleCursor,
    touchAction: ctx.axis === "y" ? "pan-x" : "pan-y",
    ...style,
  }

  return (
    <Tag ref={setRef} style={mergedStyle} {...handlers} {...rest}>
      {children}
    </Tag>
  )
}

export const Reorder = {
  Group: ReorderGroup,
  Item: ReorderItem,
}
