/**
 * `useTransform(source, inputRange, outputRange, opts?)` returns a
 * derived `MotionValue<T>` that recomputes whenever `source` updates.
 * The derived cell is destroyed when the calling component unmounts.
 */

import {
  type MotionValue,
  type TransformInputRange,
  type TransformOpts,
  type TransformOutputRange,
  motionValue,
  transform,
} from "@kinem/core"
import { onBeforeUnmount } from "vue"

export function useTransform<T>(
  source: MotionValue<number>,
  inputRange: TransformInputRange,
  outputRange: TransformOutputRange<T>,
  opts: TransformOpts = {},
): MotionValue<T> {
  const map = transform(inputRange, outputRange, opts)
  const derived = motionValue<T>(map(source.get()))

  const off = source.on((value) => {
    derived.set(map(value))
  })

  onBeforeUnmount(() => {
    off()
    derived.destroy()
  })

  return derived
}
