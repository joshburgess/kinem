/**
 * `useMotionValue(initial)` returns a stable `MotionValue<T>` cell tied
 * to the calling component's lifetime. Updates do not trigger re-renders;
 * subscribers (CSS bindings, `useTransform`, gesture handlers) read
 * directly via `get()` / `on()`.
 *
 *   const x = useMotionValue(0)
 *   onMounted(() => bindMotionValueToCss(x, el.value!, "--x", (n) => `${n}px`))
 */

import { type MotionValue, motionValue } from "@kinem/core"
import { onBeforeUnmount } from "vue"

export function useMotionValue<T>(initial: T): MotionValue<T> {
  const mv = motionValue(initial)
  onBeforeUnmount(() => {
    mv.destroy()
  })
  return mv
}
