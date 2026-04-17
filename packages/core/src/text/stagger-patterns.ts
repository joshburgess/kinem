/**
 * Stagger patterns beyond the built-in `"start" | "end" | "center" | "edges"`
 * set. Each helper returns a `StaggerFn` suitable as the `from` option
 * on the core `stagger()` combinator:
 *
 *   stagger(fadeIn, { each: 40, count: 20, from: fromGrid({ rows: 4, cols: 5 }) })
 *
 * The `StaggerFn` returns an "order index" per element; `stagger()`
 * normalizes the range to start at 0 and multiplies by `each` to get
 * per-element delays.
 */

import type { StaggerFn } from "../core/types"

export interface GridOpts {
  readonly rows: number
  readonly cols: number
  /**
   * Origin that the stagger radiates from. Coordinates are in grid
   * cells (row, column), zero-based. Defaults to the grid center.
   * The special strings `"center"`, `"start"`, `"end"` pick a corner
   * or the middle.
   */
  readonly origin?: "center" | "start" | "end" | readonly [row: number, col: number]
  /**
   * Distance metric. `"euclidean"` is the natural radial spread,
   * `"chebyshev"` produces concentric squares, `"manhattan"` produces
   * diamonds. Defaults to `"euclidean"`.
   */
  readonly metric?: "euclidean" | "manhattan" | "chebyshev"
}

/**
 * Stagger outward from a point on a 2D grid. Elements are assumed to
 * be laid out in row-major order (index 0 is the top-left, index
 * `cols - 1` ends the first row, etc.). Closer cells animate first.
 */
export function fromGrid(opts: GridOpts): StaggerFn {
  const { rows, cols } = opts
  if (rows < 1 || cols < 1) {
    throw new RangeError("fromGrid(): rows and cols must be >= 1")
  }
  const metric = opts.metric ?? "euclidean"
  const origin = opts.origin ?? "center"
  const [or, oc] = resolveOrigin(origin, rows, cols)
  return (i, count) => {
    if (i >= rows * cols) {
      // caller passed a count larger than the grid; fall back to row-major
      // by wrapping the extras into the nearest cell
      i = i % (rows * cols)
    }
    void count
    const r = Math.floor(i / cols)
    const c = i % cols
    const dr = r - or
    const dc = c - oc
    switch (metric) {
      case "manhattan":
        return Math.abs(dr) + Math.abs(dc)
      case "chebyshev":
        return Math.max(Math.abs(dr), Math.abs(dc))
      default:
        return Math.sqrt(dr * dr + dc * dc)
    }
  }
}

function resolveOrigin(
  origin: GridOpts["origin"],
  rows: number,
  cols: number,
): readonly [number, number] {
  if (typeof origin === "string") {
    switch (origin) {
      case "start":
        return [0, 0]
      case "end":
        return [rows - 1, cols - 1]
      default:
        return [(rows - 1) / 2, (cols - 1) / 2]
    }
  }
  if (origin) return [origin[0], origin[1]]
  return [(rows - 1) / 2, (cols - 1) / 2]
}

export interface ShuffleOpts {
  /** Deterministic seed for reproducibility. Omit for a fresh shuffle each call. */
  readonly seed?: number
}

/**
 * Randomize stagger order. With a `seed`, produces the same
 * permutation across runs (helpful for tests or replayable demos).
 *
 * Note: the permutation is captured on first call for each unique
 * count, so every element gets a consistent order within one stagger.
 */
export function shuffle(opts: ShuffleOpts = {}): StaggerFn {
  const cache = new Map<number, Float64Array>()
  return (i, count) => {
    let perm = cache.get(count)
    if (!perm) {
      perm = buildPermutation(count, opts.seed)
      cache.set(count, perm)
    }
    return perm[i] ?? 0
  }
}

function buildPermutation(n: number, seed?: number): Float64Array {
  const arr = new Float64Array(n)
  for (let i = 0; i < n; i++) arr[i] = i
  const rng = seed === undefined ? Math.random : lcg(seed)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i] as number
    arr[i] = arr[j] as number
    arr[j] = tmp
  }
  return arr
}

function lcg(seed: number): () => number {
  let s = seed | 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return ((s >>> 0) % 0xffffffff) / 0xffffffff
  }
}

export interface WaveOpts {
  /**
   * How much the sine wave offsets each element's order, measured in
   * multiples of `each`. An amplitude of 1 offsets up to ±1 slot.
   */
  readonly amplitude: number
  /**
   * Number of full waves across the element range. Defaults to 1.
   */
  readonly frequency?: number
  /** Phase offset in radians. Defaults to 0. */
  readonly phase?: number
}

/**
 * Apply a sine-wave offset on top of a linear stagger. Elements
 * ripple in/out of the base order by up to `amplitude` slots.
 */
export function wave(opts: WaveOpts): StaggerFn {
  const amplitude = opts.amplitude
  const frequency = opts.frequency ?? 1
  const phase = opts.phase ?? 0
  return (i, count) => {
    if (count <= 1) return i
    const t = i / (count - 1)
    return i + amplitude * Math.sin(2 * Math.PI * frequency * t + phase)
  }
}
