/**
 * Builds a new object containing only the entries whose values are not
 * `undefined`. Exists because `exactOptionalPropertyTypes: true` rejects
 * `{ key: undefined }` when the target type declares `key?: T`. Without
 * this helper, callers end up writing
 *
 *   { ...(opts.easing !== undefined ? { easing: opts.easing } : {}) }
 *
 * for every optional field they want to forward, which is noisy and
 * easy to get wrong (forgetting one field silently passes `undefined`
 * down the chain).
 *
 * Returns a partial of the input keyset; keys whose values were
 * `undefined` are absent from the result rather than present-and-undefined.
 *
 *   omitUndefined({ duration: 300, easing: undefined })
 *   // -> { duration: 300 }
 */
export function omitUndefined<T extends object>(
  input: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const out: Partial<T> = {}
  for (const key in input) {
    const value = input[key]
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> }
}
