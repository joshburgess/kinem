/**
 * `useInView(opts)` returns `[ref, inView]`. The `inView` boolean flips
 * when the bound element enters or leaves the viewport per the
 * IntersectionObserver-based `inView()` core helper.
 *
 *   const { ref, inView: visible } = useInView({ amount: "all", once: true })
 *
 * The hook re-renders only on transitions, not on continuous
 * intersection-ratio changes. If you need the full entry, pass an
 * `onEnter` callback; the component does not re-render on each call.
 */

import { type InViewEntry, type InViewOpts, type InViewStop, inView } from "@kinem/core"
import { useEffect, useMemo, useRef, useState } from "react"

export interface UseInViewOpts extends InViewOpts {
  readonly onEnter?: (entry: InViewEntry) => undefined | (() => void)
}

export interface UseInViewResult<T extends Element = Element> {
  readonly ref: (el: T | null) => void
  readonly inView: boolean
}

export function useInView<T extends Element = Element>(
  opts: UseInViewOpts = {},
): UseInViewResult<T> {
  const [visible, setVisible] = useState(false)
  const elRef = useRef<T | null>(null)
  const stopRef = useRef<InViewStop | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const ref = useMemo<(el: T | null) => void>(() => {
    return (el: T | null): void => {
      if (el === elRef.current) return
      if (stopRef.current) {
        stopRef.current()
        stopRef.current = null
      }
      elRef.current = el
      if (!el) return
      stopRef.current = inView(
        el,
        (entry) => {
          setVisible(true)
          const userLeave = optsRef.current.onEnter?.(entry)
          return () => {
            setVisible(false)
            if (typeof userLeave === "function") userLeave()
          }
        },
        optsRef.current,
      )
    }
  }, [])

  useEffect(() => {
    return () => {
      stopRef.current?.()
      stopRef.current = null
    }
  }, [])

  return { ref, inView: visible }
}
