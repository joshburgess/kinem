/**
 * `useTime()` returns a `TimeMotionValue` that ticks on every animation
 * frame, holding milliseconds since the composable ran. The cell is
 * destroyed when the calling component unmounts.
 *
 *   const t = useTime()
 *   const opacity = useTransform(t, [0, 2000], [0, 1])
 */

import { type TimeMotionValue, time } from "@kinem/core"
import { onBeforeUnmount } from "vue"

export function useTime(): TimeMotionValue {
  const mv = time()
  onBeforeUnmount(() => {
    mv.destroy()
  })
  return mv
}
