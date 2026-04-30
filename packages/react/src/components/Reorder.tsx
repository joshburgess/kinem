/**
 * `Reorder` is a drag-to-sort list. `Reorder.Group` owns the values
 * array and reorder callback. `Reorder.Item` registers itself with the
 * group, becomes draggable along the group's axis, and asks the group
 * to commit a new order whenever the dragged item's center crosses a
 * neighbour's. Sibling translates are applied mid-drag to make room;
 * pointer release commits the new order if it changed and clears the
 * transient transforms.
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
  type ReorderAxis,
  type ReorderController,
  type ReorderDragSession,
  createReorderController,
} from "@kinem/core"
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

export type { ReorderAxis }

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

const ReorderContext = createContext<ReorderController<unknown> | null>(null)

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
  const valuesRef = useRef<readonly T[]>(values)
  valuesRef.current = values
  const onReorderRef = useRef<(next: T[]) => void>(onReorder)
  onReorderRef.current = onReorder

  const ctrl = useMemo<ReorderController<T>>(
    () =>
      createReorderController<T>({
        axis,
        getValues: () => valuesRef.current,
        commit: (next) => onReorderRef.current(next),
      }),
    [axis],
  )

  return (
    <ReorderContext.Provider value={ctrl as ReorderController<unknown>}>
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
  const ctx = useContext(ReorderContext) as ReorderController<T> | null
  if (!ctx) {
    throw new Error("Reorder.Item must be rendered inside a Reorder.Group")
  }

  const elRef = useRef<HTMLElement | null>(null)
  const sessionRef = useRef<ReorderDragSession | null>(null)
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
