/**
 * Component-wise linear interpolation for fixed-length numeric arrays.
 * Used for GLSL-style vectors (vec2/vec3/vec4) and flat matrices (mat4).
 *
 * The source and target must have the same length. Output is a fresh
 * array per frame (the caller may copy it into a typed array if needed).
 */

import { KinemError } from "../core/errors"

export function interpolateNumbers(
  from: readonly number[],
  to: readonly number[],
): (progress: number) => number[] {
  if (from.length !== to.length) {
    throw new KinemError(
      `interpolateNumbers(): length mismatch (${from.length} vs ${to.length})`,
      "from and to must have the same length (e.g. both vec3 or both mat4)",
    )
  }
  const n = from.length
  const deltas = new Array<number>(n)
  for (let i = 0; i < n; i++) deltas[i] = (to[i] as number) - (from[i] as number)
  return (p) => {
    const out = new Array<number>(n)
    for (let i = 0; i < n; i++) out[i] = (from[i] as number) + (deltas[i] as number) * p
    return out
  }
}
