/**
 * `useMotionValue(initial)` returns a stable `MotionValue<T>` cell that
 * survives re-renders and is torn down on unmount. The hook never
 * triggers a re-render when the underlying value changes; subscribers
 * (CSS bindings, `useTransform`, gesture handlers, animation tracks)
 * read the value directly via `get()` or via `on()`.
 *
 *   const x = useMotionValue(0)
 *   useEffect(() => bindMotionValueToCss(x, ref.current!, "--x", (n) => `${n}px`), [])
 *
 * If the caller wants React state to track the value (rare, since the
 * whole point of MotionValue is to bypass React state), they can wire a
 * subscription manually with useState in an effect.
 */

import { type MotionValue, motionValue } from "@kinem/core"
import { useEffect, useState } from "react"

export function useMotionValue<T>(initial: T): MotionValue<T> {
  // useState lazy initializer allocates exactly once per logical mount;
  // re-renders return the same cell. We never call setState — the cell
  // itself owns its subscribers.
  const [mv] = useState(() => motionValue(initial))

  useEffect(() => {
    return () => {
      mv.destroy()
    }
  }, [mv])

  return mv
}
