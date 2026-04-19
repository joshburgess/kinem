/**
 * Interpolation registry.
 *
 * Given a pair of values, dispatches to the appropriate interpolator
 * based on the shape of the source value. The registry itself is empty
 * at module load. Built-in interpolators (number, numbers, color,
 * transform, path, CSS units) are registered by `register-defaults.ts`,
 * which the main `index.ts` imports for its side effect. Bundles that
 * do not import `register-defaults` (notably the `slim` entry) can
 * tree-shake the associated interpolator modules.
 *
 * User-registered entries take precedence over built-ins, so custom
 * rules override the defaults.
 */

export type ValueInterpolator<T> = (from: T, to: T) => (progress: number) => T

export interface InterpolatorEntry {
  readonly name: string
  readonly test: (value: unknown) => boolean
  readonly interpolate: ValueInterpolator<unknown>
}

const registry: InterpolatorEntry[] = []

/**
 * Register a custom interpolator. Newly registered entries take
 * precedence over any already registered, including built-ins.
 *
 * The `priority` parameter is for internal use: `register-defaults.ts`
 * appends built-ins as low-priority entries so user registrations
 * continue to override them.
 */
export function registerInterpolator(
  entry: InterpolatorEntry,
  priority: "high" | "low" = "high",
): void {
  if (priority === "low") registry.push(entry)
  else registry.unshift(entry)
}

/**
 * Find the interpolator whose predicate matches `value`. Returns `null`
 * if no entry applies.
 */
export function findInterpolator(value: unknown): InterpolatorEntry | null {
  for (const entry of registry) {
    if (entry.test(value)) return entry
  }
  return null
}

/**
 * Dispatch-aware interpolation between two values. The source value
 * determines which interpolator is used; the target value is expected to
 * be the same kind.
 *
 * Returns the registered interpolator's output directly, cast to the
 * caller's T. Wrapping it in `(p) => fn(p) as T` would be a pure trampoline
 * (the cast is compile-time only), adding one function call per property
 * interpolation per frame.
 */
export function interpolate<T>(from: T, to: T): (progress: number) => T {
  const entry = findInterpolator(from)
  if (!entry) {
    throw new Error(`No interpolator registered for value of type ${typeof from}: ${String(from)}`)
  }
  return entry.interpolate(from as unknown, to as unknown) as (p: number) => T
}
