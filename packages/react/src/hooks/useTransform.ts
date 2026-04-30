/**
 * `useTransform(source, inputRange, outputRange, opts?)` returns a
 * derived `MotionValue<T>` that recomputes whenever `source` updates.
 *
 *   const scrollY = useMotionValue(0)
 *   const opacity = useTransform(scrollY, [0, 200], [1, 0])
 *
 * The mapping function is rebuilt only when the input or output range
 * length changes. Re-rendering with new range *contents* does not
 * rebuild the segments, so updating per-frame from a layout effect is
 * cheap. If callers need range contents to participate in identity,
 * they should memoize them.
 */

import {
  type MotionValue,
  type TransformInputRange,
  type TransformOpts,
  type TransformOutputRange,
  motionValue,
  transform,
} from "@kinem/core"
import { useEffect, useRef, useState } from "react"

export function useTransform<T>(
  source: MotionValue<number>,
  inputRange: TransformInputRange,
  outputRange: TransformOutputRange<T>,
  opts: TransformOpts = {},
): MotionValue<T> {
  const mapRef = useRef<(input: number) => T>(transform(inputRange, outputRange, opts))

  const [derived] = useState<MotionValue<T>>(() => motionValue<T>(mapRef.current(source.get())))

  // Rebuild the map when range identity changes. We use a structural
  // signature (length + JSON) to avoid forcing the caller to memoize;
  // for tight inner-loop usage they should pass stable ranges anyway.
  const sig = `${inputRange.length}|${JSON.stringify(inputRange)}|${JSON.stringify(outputRange)}|${opts.clamp === false ? 0 : 1}`
  const lastSigRef = useRef(sig)
  if (lastSigRef.current !== sig) {
    lastSigRef.current = sig
    mapRef.current = transform(inputRange, outputRange, opts)
    derived.set(mapRef.current(source.get()))
  }

  useEffect(() => {
    derived.set(mapRef.current(source.get()))
    const off = source.on((value) => {
      derived.set(mapRef.current(value))
    })
    return off
  }, [source, derived])

  useEffect(() => {
    return () => {
      derived.destroy()
    }
  }, [derived])

  return derived
}
