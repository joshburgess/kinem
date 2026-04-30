/**
 * `useTime()` returns a `TimeMotionValue` that ticks on every animation
 * frame, holding milliseconds since mount. The cell is stable across
 * re-renders and torn down on unmount. The hook does not trigger React
 * re-renders; subscribers (CSS bindings, transforms, manual `on()`)
 * read the value directly.
 *
 *   const t = useTime()
 *   const opacity = useTransform(t, [0, 2000], [0, 1])
 */

import { type TimeMotionValue, time } from "@kinem/core"
import { useEffect, useState } from "react"

export function useTime(): TimeMotionValue {
  const [mv] = useState(() => time())
  useEffect(() => {
    return () => {
      mv.destroy()
    }
  }, [mv])
  return mv
}
