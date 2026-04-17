/**
 * `<AnimatePresence>` defers unmount of keyed children so they can play
 * an exit animation before leaving the tree. It inspects its children
 * on every render, detects keys that vanished, and keeps those elements
 * mounted (wrapped in a PresenceContext with `isPresent: false`) until
 * each signals `safeToRemove()`.
 *
 * Only direct children with explicit `key` props participate. Children
 * without keys are treated as static and re-rendered as-is.
 *
 *   <AnimatePresence>
 *     {show && (
 *       <Motion key="box" initial={{ opacity: 0 }}
 *               animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
 *     )}
 *   </AnimatePresence>
 *
 * The child is responsible for calling `presence.safeToRemove()` once
 * its exit animation settles. The built-in `<Motion>` component does
 * this automatically.
 */

import {
  Children,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
} from "react"
import { PresenceContext, type PresenceValue } from "./presence"

export interface AnimatePresenceProps {
  readonly children?: ReactNode
}

interface TrackedChild {
  readonly key: string
  readonly element: ReactElement
  readonly present: boolean
}

function keyedChildren(children: ReactNode): Map<string, ReactElement> {
  const map = new Map<string, ReactElement>()
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.key == null) return
    map.set(String(child.key), child)
  })
  return map
}

function reconcile(
  prev: readonly TrackedChild[],
  incoming: Map<string, ReactElement>,
): TrackedChild[] {
  const prevKeys = new Set(prev.map((t) => t.key))
  const next: TrackedChild[] = []
  for (const t of prev) {
    const current = incoming.get(t.key)
    if (current) {
      next.push({ key: t.key, element: current, present: true })
    } else {
      next.push({ key: t.key, element: t.element, present: false })
    }
  }
  for (const [key, element] of incoming) {
    if (!prevKeys.has(key)) {
      next.push({ key, element, present: true })
    }
  }
  return next
}

export function AnimatePresence(props: AnimatePresenceProps): ReactElement {
  const { children } = props
  const [tracked, setTracked] = useState<readonly TrackedChild[]>(() => {
    const initial: TrackedChild[] = []
    for (const [key, element] of keyedChildren(children)) {
      initial.push({ key, element, present: true })
    }
    return initial
  })

  useEffect(() => {
    const incoming = keyedChildren(children)
    setTracked((prev) => {
      const next = reconcile(prev, incoming)
      if (next.length === prev.length && next.every((t, i) => t === prev[i])) return prev
      return next
    })
  }, [children])

  const removeChild = useCallback((key: string) => {
    setTracked((prev) => prev.filter((t) => t.key !== key))
  }, [])

  return (
    <>
      {tracked.map((t) => {
        const value: PresenceValue = {
          isPresent: t.present,
          safeToRemove: () => removeChild(t.key),
        }
        return (
          <PresenceContext.Provider key={t.key} value={value}>
            {cloneElement(t.element)}
          </PresenceContext.Provider>
        )
      })}
    </>
  )
}
