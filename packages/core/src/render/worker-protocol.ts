/**
 * Serializable mass-interpolation protocol.
 *
 * A `WorkerAnimSpec` describes a numeric-only animation in a shape that
 * can round-trip through `postMessage`: start time, duration, easing id,
 * and per-property `[from, to]` numeric ranges. The compute function
 * `computeValues` takes a list of specs plus the current time and
 * returns one value map per active spec.
 *
 * The same compute function runs in-thread (for small animation counts
 * and for testing) and inside a Web Worker (for very large counts where
 * the main-thread interpolation cost dominates). Because it is pure and
 * numeric-only, it has no dependency on the rest of the library and is
 * cheap to bundle into a worker.
 *
 * The set of easings is deliberately small. Arbitrary `EasingFn`s cannot
 * cross the worker boundary; callers animating with custom easings must
 * stay on the main thread via the regular `playStrategy` backend.
 */

export type WorkerEasingId =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | {
      readonly kind: "cubic-bezier"
      readonly x1: number
      readonly y1: number
      readonly x2: number
      readonly y2: number
    }
  | { readonly kind: "steps"; readonly n: number; readonly position: "start" | "end" }

export interface WorkerAnimSpec {
  /** Stable id for routing the output back to a DOM element. */
  readonly id: string
  /** Clock time (ms) at which the animation started. */
  readonly startTime: number
  /** Duration in ms. 0 is legal; progress snaps to 1 immediately. */
  readonly duration: number
  readonly easing: WorkerEasingId
  /** Per-property `[from, to]` numeric tuples. */
  readonly properties: Readonly<Record<string, readonly [number, number]>>
  /**
   * If true, the spec is kept alive past `duration` and its values
   * clamp to the `to` endpoint. If false (the default), the spec drops
   * out of the output map once `time >= startTime + duration`.
   */
  readonly holdAtEnd?: boolean
}

export type WorkerValues = Readonly<Record<string, Readonly<Record<string, number>>>>

const EASE_IN = (p: number): number => p * p
const EASE_OUT = (p: number): number => 1 - (1 - p) * (1 - p)
const EASE_IN_OUT = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

function cubicBezierSolve(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const ax = 3 * x1 - 3 * x2 + 1
  const bx = 3 * x2 - 6 * x1
  const cx = 3 * x1
  const ay = 3 * y1 - 3 * y2 + 1
  const by = 3 * y2 - 6 * y1
  const cy = 3 * y1
  let t = x
  for (let i = 0; i < 8; i++) {
    const xt = ((ax * t + bx) * t + cx) * t - x
    const d = (3 * ax * t + 2 * bx) * t + cx
    if (d === 0) break
    t -= xt / d
  }
  return ((ay * t + by) * t + cy) * t
}

function applyEasing(id: WorkerEasingId, p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  if (typeof id === "string") {
    if (id === "linear") return p
    if (id === "ease-in") return EASE_IN(p)
    if (id === "ease-out") return EASE_OUT(p)
    if (id === "ease-in-out") return EASE_IN_OUT(p)
    return p
  }
  if (id.kind === "cubic-bezier") {
    return cubicBezierSolve(id.x1, id.y1, id.x2, id.y2, p)
  }
  // steps
  if (id.position === "start") {
    return Math.min(1, (Math.floor(p * id.n) + 1) / id.n)
  }
  return Math.floor(p * id.n) / id.n
}

/**
 * Compute current values for every active spec at `time`. Specs that
 * have ended (and are not `holdAtEnd`) are omitted from the result.
 */
export function computeValues(specs: readonly WorkerAnimSpec[], time: number): WorkerValues {
  const out: Record<string, Record<string, number>> = {}
  for (const spec of specs) {
    const elapsed = time - spec.startTime
    let progress: number
    if (spec.duration <= 0) {
      progress = 1
    } else if (elapsed <= 0) {
      progress = 0
    } else if (elapsed >= spec.duration) {
      if (!spec.holdAtEnd) continue
      progress = 1
    } else {
      progress = elapsed / spec.duration
    }
    const eased = applyEasing(spec.easing, progress)
    const values: Record<string, number> = {}
    for (const key in spec.properties) {
      const range = spec.properties[key]
      if (!range) continue
      const [from, to] = range
      values[key] = from + (to - from) * eased
    }
    out[spec.id] = values
  }
  return out
}

/**
 * Message envelope used by the worker wrapper. Kept here because both
 * sides of the channel need the shape.
 */
export interface WorkerComputeRequest {
  readonly type: "compute"
  /** Echoed back in the response so callers can match request/response. */
  readonly seq: number
  readonly time: number
  readonly specs: readonly WorkerAnimSpec[]
}

export interface WorkerComputeResponse {
  readonly type: "values"
  readonly seq: number
  readonly values: WorkerValues
}
