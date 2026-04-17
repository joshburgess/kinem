/**
 * Worker backend for mass numeric interpolation.
 *
 * `createWorkerComputer()` returns a `Computer` that takes a list of
 * `WorkerAnimSpec`s plus the current time and resolves to a value map.
 * The implementation transparently falls back to synchronous in-thread
 * compute when no `Worker` global is available (Node, SSR) or when the
 * caller explicitly passes `{ mode: "inline" }`. This lets the same
 * call site work in tests, on the server, and in the browser.
 *
 * When a real Worker is used, the module body is serialized to a Blob
 * URL at construction time. Requests go through `postMessage` and are
 * matched to responses by a monotonic sequence number. Callers dispose
 * the worker with `computer.terminate()`.
 *
 * Overhead note: sending and receiving 1000 small objects via
 * `postMessage` is not free. The break-even point vs main-thread compute
 * depends on the browser and animation count; callers should measure
 * before opting in. See `benchmarks/src/mass-interpolation.bench.ts`.
 */

import {
  type WorkerAnimSpec,
  type WorkerComputeRequest,
  type WorkerComputeResponse,
  type WorkerValues,
  computeValues,
} from "./worker-protocol"

export type ComputerMode = "auto" | "inline" | "worker"

export interface Computer {
  /** Compute interpolated values for all `specs` at `time`. */
  compute(specs: readonly WorkerAnimSpec[], time: number): Promise<WorkerValues>
  /** Compute synchronously. Throws in worker mode. */
  computeSync(specs: readonly WorkerAnimSpec[], time: number): WorkerValues
  terminate(): void
  readonly mode: "inline" | "worker"
}

interface WorkerLike {
  postMessage(msg: WorkerComputeRequest): void
  terminate(): void
  addEventListener(type: "message", cb: (ev: { data: WorkerComputeResponse }) => void): void
  removeEventListener(type: "message", cb: (ev: { data: WorkerComputeResponse }) => void): void
}

interface WorkerCtor {
  new (url: string, opts?: { type?: "module" | "classic" }): WorkerLike
}

export interface WorkerComputerOpts {
  readonly mode?: ComputerMode
  /**
   * Inject the `Worker` constructor. Defaults to `globalThis.Worker`.
   * Tests pass a fake; SSR code paths can set it to `undefined` (which
   * forces inline mode).
   */
  readonly Worker?: WorkerCtor | undefined
  /**
   * Inject the Blob URL factory. Defaults to
   * `URL.createObjectURL(new Blob([...], { type: "application/javascript" }))`.
   */
  readonly workerUrl?: () => string
}

/**
 * JavaScript source that runs inside the Worker. It inlines the pure
 * compute function from `worker-protocol.ts` rather than importing it,
 * because the protocol module itself depends on TypeScript types that
 * erase at runtime. The function below is intentionally identical to
 * `computeValues` in `worker-protocol.ts` so both code paths produce
 * bit-identical output.
 */
const WORKER_SOURCE = `
const EASE_IN = (p) => p * p
const EASE_OUT = (p) => 1 - (1 - p) * (1 - p)
const EASE_IN_OUT = (p) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2

function cubicBezierSolve(x1, y1, x2, y2, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const ax = 3*x1 - 3*x2 + 1
  const bx = 3*x2 - 6*x1
  const cx = 3*x1
  const ay = 3*y1 - 3*y2 + 1
  const by = 3*y2 - 6*y1
  const cy = 3*y1
  let t = x
  for (let i = 0; i < 8; i++) {
    const xt = ((ax*t + bx)*t + cx)*t - x
    const d = (3*ax*t + 2*bx)*t + cx
    if (d === 0) break
    t -= xt / d
  }
  return ((ay*t + by)*t + cy)*t
}

function applyEasing(id, p) {
  if (p <= 0) return 0
  if (p >= 1) return 1
  if (typeof id === "string") {
    if (id === "linear") return p
    if (id === "ease-in") return EASE_IN(p)
    if (id === "ease-out") return EASE_OUT(p)
    if (id === "ease-in-out") return EASE_IN_OUT(p)
    return p
  }
  if (id.kind === "cubic-bezier") return cubicBezierSolve(id.x1, id.y1, id.x2, id.y2, p)
  if (id.position === "start") return Math.min(1, (Math.floor(p * id.n) + 1) / id.n)
  return Math.floor(p * id.n) / id.n
}

function computeValues(specs, time) {
  const out = {}
  for (const spec of specs) {
    const elapsed = time - spec.startTime
    let progress
    if (spec.duration <= 0) progress = 1
    else if (elapsed <= 0) progress = 0
    else if (elapsed >= spec.duration) {
      if (!spec.holdAtEnd) continue
      progress = 1
    } else progress = elapsed / spec.duration
    const eased = applyEasing(spec.easing, progress)
    const values = {}
    for (const key in spec.properties) {
      const range = spec.properties[key]
      if (!range) continue
      values[key] = range[0] + (range[1] - range[0]) * eased
    }
    out[spec.id] = values
  }
  return out
}

self.addEventListener("message", (ev) => {
  const { seq, time, specs } = ev.data
  const values = computeValues(specs, time)
  self.postMessage({ type: "values", seq, values })
})
`

function defaultWorkerUrl(): string {
  const g = globalThis as { URL?: typeof URL; Blob?: typeof Blob }
  if (!g.URL || !g.Blob) {
    throw new Error("createWorkerComputer: URL/Blob not available; pass opts.workerUrl")
  }
  return g.URL.createObjectURL(new g.Blob([WORKER_SOURCE], { type: "application/javascript" }))
}

function resolveWorkerCtor(opts: WorkerComputerOpts): WorkerCtor | undefined {
  if ("Worker" in opts) return opts.Worker
  const g = globalThis as { Worker?: WorkerCtor }
  return g.Worker
}

export function createWorkerComputer(opts: WorkerComputerOpts = {}): Computer {
  const mode: ComputerMode = opts.mode ?? "auto"
  const Ctor = resolveWorkerCtor(opts)

  const shouldUseWorker = mode === "worker" || (mode === "auto" && Ctor !== undefined)

  if (!shouldUseWorker || !Ctor) {
    if (mode === "worker") {
      throw new Error(
        "createWorkerComputer: worker mode requested but no Worker constructor available",
      )
    }
    return {
      mode: "inline",
      compute(specs, time) {
        return Promise.resolve(computeValues(specs, time))
      },
      computeSync(specs, time) {
        return computeValues(specs, time)
      },
      terminate() {},
    }
  }

  const url = (opts.workerUrl ?? defaultWorkerUrl)()
  const worker = new Ctor(url, { type: "classic" })

  let seq = 0
  const pending = new Map<number, (values: WorkerValues) => void>()

  const onMessage = (ev: { data: WorkerComputeResponse }): void => {
    const resolver = pending.get(ev.data.seq)
    if (!resolver) return
    pending.delete(ev.data.seq)
    resolver(ev.data.values)
  }
  worker.addEventListener("message", onMessage)

  return {
    mode: "worker",
    compute(specs, time) {
      const mySeq = ++seq
      const promise = new Promise<WorkerValues>((resolve) => {
        pending.set(mySeq, resolve)
      })
      worker.postMessage({ type: "compute", seq: mySeq, time, specs })
      return promise
    },
    computeSync() {
      throw new Error("computeSync is not available in worker mode")
    },
    terminate() {
      worker.removeEventListener("message", onMessage)
      worker.terminate()
      pending.clear()
    },
  }
}
