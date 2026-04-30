/**
 * `transform()` maps a numeric input across a sorted input range to an
 * output produced by interpolating between corresponding output stops.
 *
 *   const opacity = transform([0, 100, 200], [0, 1, 0])
 *   opacity(150) // 0.5
 *
 * Two output kinds are supported out of the box:
 *  - numbers: linear interpolation
 *  - strings: dispatched to a registered Interpolator (color, unit,
 *    transform, etc.) via the renderer's `interpolateValue` helper
 *
 * Extrapolation is configurable via `clamp` (default true). When clamp
 * is false, inputs below the first stop or above the last extrapolate
 * linearly off the nearest segment.
 *
 * The returned function is pure and allocation-free per call (the
 * per-segment interpolators are precomputed at construction time), so
 * it is safe to call from a `requestAnimationFrame` loop.
 */

import { interpolate } from "../interpolate/registry"

export type TransformInputRange = readonly [number, number, ...number[]]
export type TransformOutputRange<T> = readonly [T, T, ...T[]]

export interface TransformOpts {
  /** Clamp inputs to the input range (default true). */
  readonly clamp?: boolean
}

const buildSegment = <T>(from: T, to: T): ((p: number) => T) => {
  if (typeof from === "number" && typeof to === "number") {
    const a = from
    const b = to
    return (p) => (a + (b - a) * p) as unknown as T
  }
  // Delegate to the registry, which routes through registered
  // interpolators (color, unit, transform, path, etc.).
  return interpolate(from, to)
}

export function transform<T>(
  inputRange: TransformInputRange,
  outputRange: TransformOutputRange<T>,
  opts: TransformOpts = {},
): (input: number) => T {
  if (inputRange.length !== outputRange.length) {
    throw new Error(
      `transform(): inputRange (${inputRange.length}) and outputRange (${outputRange.length}) must have the same length`,
    )
  }
  if (inputRange.length < 2) {
    throw new Error("transform(): ranges must have at least 2 stops")
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (inputRange[i]! <= inputRange[i - 1]!) {
      throw new Error("transform(): inputRange must be strictly increasing")
    }
  }

  const clamp = opts.clamp !== false
  const stops = inputRange
  const segments: Array<(p: number) => T> = []
  for (let i = 0; i < outputRange.length - 1; i++) {
    segments.push(buildSegment(outputRange[i]!, outputRange[i + 1]!))
  }
  const first = outputRange[0]!
  const last = outputRange[outputRange.length - 1]!

  return (input: number): T => {
    if (clamp) {
      if (input <= stops[0]!) return first
      if (input >= stops[stops.length - 1]!) return last
    }
    // Find the segment containing `input`.
    let i = 0
    for (; i < stops.length - 2; i++) {
      if (input < stops[i + 1]!) break
    }
    const a = stops[i]!
    const b = stops[i + 1]!
    const span = b - a
    const p = span === 0 ? 0 : (input - a) / span
    return segments[i]!(p)
  }
}
