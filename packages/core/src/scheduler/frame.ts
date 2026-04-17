/**
 * Frame scheduler with four ordered phases per tick:
 *
 *   read → compute → update → render
 *
 * Jobs enqueued into a phase run in insertion order. All DOM reads go
 * in `read`, all DOM writes go in `update` / `render`. Keeping them
 * strictly phase-ordered avoids layout thrashing: the browser never
 * observes a read after a write within one frame.
 *
 * Jobs added *during* a tick:
 *   - to the currently-running phase or an earlier one → defer to the
 *     next tick (prevents unbounded re-entry within a single frame).
 *   - to a later phase in the same tick → run in that phase this tick.
 *     This is the useful pattern: a `read` can enqueue a follow-up
 *     `update` that consumes the measurement without a frame delay.
 *
 * The scheduler is lazy. It only runs a RAF loop while at least one
 * phase has pending jobs or a pending "keepalive" registration. When
 * everything drains, it cancels RAF and sleeps.
 *
 * Jobs may reschedule themselves by passing `keepalive: true`. This is
 * how the rAF rendering backend keeps ticking while an animation plays.
 */

export type FrameJob = (state: FrameState) => void

export interface FrameState {
  /** Clock time at the start of this tick, in ms. */
  readonly time: number
  /** Delta from the previous tick, in ms. `0` on the first tick. */
  readonly delta: number
  /** Monotonic tick index, starting at 0. */
  readonly tick: number
}

export type Phase = "read" | "compute" | "update" | "render"

const PHASES: readonly Phase[] = ["read", "compute", "update", "render"]

export interface RafLike {
  request(cb: (time: number) => void): number
  cancel(id: number): void
}

const defaultRaf: RafLike = (() => {
  if (typeof requestAnimationFrame === "function" && typeof cancelAnimationFrame === "function") {
    return {
      request: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
    }
  }
  // Fallback: simulate ~60fps via setTimeout. Used in non-DOM envs.
  return {
    request: (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number,
    cancel: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
  }
})()

export interface FrameSchedulerOpts {
  readonly raf?: RafLike
  readonly now?: () => number
}

interface PhaseQueue {
  /** Jobs to run on the next tick only. */
  jobs: FrameJob[]
  /** Jobs to run every tick until explicitly cancelled. */
  keepalive: Set<FrameJob>
}

export interface FrameScheduler {
  /** Enqueue `fn` to run in `phase` on the next frame. */
  schedule(phase: Phase, fn: FrameJob, opts?: { keepalive?: boolean }): void
  /** Remove a keepalive job. No-op if the job is not registered. */
  cancel(phase: Phase, fn: FrameJob): void
  /** Force a tick synchronously. Test-only; returns the consumed state. */
  flushSync(time?: number): FrameState
  /** Current tick index (advances after each tick). */
  readonly tick: number
  /** True while the RAF loop is scheduled. */
  readonly isRunning: boolean
}

export function createFrameScheduler(opts: FrameSchedulerOpts = {}): FrameScheduler {
  const raf = opts.raf ?? defaultRaf
  const nowFn =
    opts.now ??
    ((): number => (typeof performance !== "undefined" ? performance.now() : Date.now()))

  const queues: Record<Phase, PhaseQueue> = {
    read: { jobs: [], keepalive: new Set() },
    compute: { jobs: [], keepalive: new Set() },
    update: { jobs: [], keepalive: new Set() },
    render: { jobs: [], keepalive: new Set() },
  }

  let rafId: number | null = null
  let tickIndex = 0
  let lastTime = -1
  // O(1) work counter: incremented on schedule/add, decremented on
  // drain/cancel. Replaces the per-tick 4-phase scan hasWork() used to
  // do. `jobsCount` tracks one-shot jobs in flight; `keepCount` tracks
  // keepalive registrations. `hasWork()` is `(jobsCount + keepCount) > 0`.
  let jobsCount = 0
  let keepCount = 0

  const hasWork = (): boolean => jobsCount + keepCount > 0

  const runTick = (time: number): FrameState => {
    const delta = lastTime < 0 ? 0 : time - lastTime
    lastTime = time
    const state: FrameState = { time, delta, tick: tickIndex }

    for (const phase of PHASES) {
      const q = queues[phase]
      const jobsLen = q.jobs.length
      const keepSize = q.keepalive.size
      // Skip the whole phase when there's nothing to run. Avoids an
      // empty-array swap and an empty Set iteration per empty phase,
      // which in steady state is 3 of 4 phases for a typical animation.
      if (jobsLen === 0 && keepSize === 0) continue

      if (jobsLen > 0) {
        // Snapshot the one-shot list so jobs enqueued during this phase
        // (for any phase) don't run until the next frame.
        const pending = q.jobs
        q.jobs = []
        jobsCount -= jobsLen
        for (let i = 0; i < jobsLen; i++) {
          const job = pending[i]
          if (job) job(state)
        }
      }

      if (keepSize > 0) {
        // Iterate the Set in place. V8/JSC/SpiderMonkey all honor the
        // Set iterator contract that `.delete()` during iteration is
        // safe: the removed entry won't be visited again, and entries
        // added during iteration may or may not be visited. That's
        // fine for animation teardown (the finish handler removes
        // itself) because the semantics we care about is "this entry
        // ran this frame; any new entry will run next frame." Skipping
        // the Array.from() copy saves an allocation per non-empty
        // phase per tick.
        for (const job of q.keepalive) job(state)
      }
    }

    tickIndex++
    return state
  }

  const loop = (time: number): void => {
    rafId = null
    runTick(time)
    if (hasWork()) {
      rafId = raf.request(loop)
    } else {
      lastTime = -1
    }
  }

  const wake = (): void => {
    if (rafId !== null) return
    rafId = raf.request(loop)
  }

  return {
    schedule(phase, fn, o) {
      const q = queues[phase]
      if (o?.keepalive) {
        const before = q.keepalive.size
        q.keepalive.add(fn)
        if (q.keepalive.size !== before) keepCount++
      } else {
        q.jobs.push(fn)
        jobsCount++
      }
      wake()
    },
    cancel(phase, fn) {
      const q = queues[phase]
      if (q.keepalive.delete(fn)) keepCount--
      if (!hasWork() && rafId !== null) {
        raf.cancel(rafId)
        rafId = null
        lastTime = -1
      }
    },
    flushSync(time = nowFn()) {
      if (rafId !== null) {
        raf.cancel(rafId)
        rafId = null
      }
      const state = runTick(time)
      if (hasWork()) rafId = raf.request(loop)
      else lastTime = -1
      return state
    },
    get tick() {
      return tickIndex
    },
    get isRunning() {
      return rafId !== null
    },
  }
}

/**
 * Shared process-wide scheduler. Production code should use this so
 * all animations share one RAF loop. Tests should construct their own
 * via `createFrameScheduler` with a mock `raf` / `now`.
 */
export const frame: FrameScheduler = createFrameScheduler()
