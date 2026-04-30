/**
 * `useVelocity(source)` returns a `MotionValue<number>` that mirrors
 * the per-second derivative of a numeric source `MotionValue`. It is
 * stable across re-renders for the same source identity, and is
 * recreated (and the previous instance destroyed) if the source
 * identity changes.
 *
 *   const x = useMotionValue(0)
 *   const vx = useVelocity(x)
 */

import { type MotionValue, type VelocityMotionValue, velocity } from "@kinem/core"
import { useEffect, useRef } from "react"

export function useVelocity(source: MotionValue<number>): VelocityMotionValue {
  const sourceRef = useRef(source)
  const mvRef = useRef<VelocityMotionValue | null>(null)
  if (mvRef.current === null || sourceRef.current !== source) {
    if (mvRef.current) mvRef.current.destroy()
    sourceRef.current = source
    mvRef.current = velocity(source)
  }

  useEffect(() => {
    return () => {
      mvRef.current?.destroy()
      mvRef.current = null
    }
  }, [])

  return mvRef.current
}
