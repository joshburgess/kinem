/**
 * Linear numeric interpolation. Returns a function that, given progress
 * in [0, 1], linearly blends between `from` and `to`.
 *
 * Values outside [0, 1] extrapolate. Clamping, if desired, is applied by
 * callers (typically the animation combinators clamp before dispatching).
 */
export function interpolateNumber(from: number, to: number): (progress: number) => number {
  const delta = to - from
  return (p) => from + delta * p
}
