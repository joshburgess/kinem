/**
 * `useGesture` binds `drag` and/or `hover` gesture drivers to a React
 * ref. Options are latched on mount; to reconfigure gestures, unmount
 * and remount the consuming component or call `cancel()` and reattach.
 *
 *   const { ref } = useGesture<HTMLDivElement>({
 *     drag: { axis: "x", bounds: { left: -100, right: 100 } },
 *     hover: { enter: tween({ scale: [1, 1.1] }, { duration: 150 }) },
 *   })
 *
 * The hook is imperative: it never writes React state during gesture
 * activity. Drag and hover handles are accessible via getters on the
 * returned object so callers can read `.offset`, `.isHovering`, etc.
 * from event handlers.
 */

import {
  type DragHandle,
  type DragPublicOpts,
  type HoverHandle,
  type HoverPublicOpts,
  type StrategyTarget,
  gesture,
} from "kinem"
import { useEffect, useMemo, useRef } from "react"

export interface UseGestureOpts {
  readonly drag?: DragPublicOpts
  readonly hover?: HoverPublicOpts
}

export interface UseGestureResult<T extends Element = Element> {
  readonly ref: (el: T | null) => void
  /** Active drag handle, or `null` if no drag is configured. */
  readonly drag: DragHandle | null
  /** Active hover handle, or `null` if no hover is configured. */
  readonly hover: HoverHandle | null
  /** Cancel all bound gestures. Safe to call multiple times. */
  cancel(): void
}

export function useGesture<T extends Element = Element>(opts: UseGestureOpts): UseGestureResult<T> {
  const elRef = useRef<T | null>(null)
  const dragHandleRef = useRef<DragHandle | null>(null)
  const hoverHandleRef = useRef<HoverHandle | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const boundRef = useRef(false)
  const unbindRef = useRef<() => void>(() => {})

  const result = useMemo<UseGestureResult<T>>(() => {
    const bind = (): void => {
      if (boundRef.current) return
      const el = elRef.current
      if (!el) return
      const current = optsRef.current
      const strategyEl = el as unknown as StrategyTarget
      if (current.drag) {
        dragHandleRef.current = gesture.drag([strategyEl], current.drag)
      }
      if (current.hover) {
        hoverHandleRef.current = gesture.hover([strategyEl], current.hover)
      }
      boundRef.current = true
    }
    const unbind = (): void => {
      dragHandleRef.current?.cancel()
      hoverHandleRef.current?.cancel()
      dragHandleRef.current = null
      hoverHandleRef.current = null
      boundRef.current = false
    }
    unbindRef.current = unbind
    return {
      ref(el) {
        if (el === elRef.current) return
        if (elRef.current) unbind()
        elRef.current = el
        if (el) bind()
      },
      get drag() {
        return dragHandleRef.current
      },
      get hover() {
        return hoverHandleRef.current
      },
      cancel() {
        unbind()
      },
    }
  }, [])

  useEffect(() => {
    return () => {
      unbindRef.current()
    }
  }, [])

  return result
}
