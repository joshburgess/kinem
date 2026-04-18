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

/**
 * Doubly-linked-list node for the keepalive registry. Replaces what
 * was a `Set<FrameJob>` in earlier versions. Iteration walks pointers
 * instead of a hash table, which at steady-state n=1000 (every job
 * runs every tick) trims a couple percent off the per-tick cost and
 * avoids allocating a fresh iterator object each phase per frame.
 *
 * Dedupe (registering the same fn twice is a no-op, matching the old
 * Set contract) is preserved via the `lookup` Map in `PhaseQueue`.
 */
interface KeepaliveNode {
  fn: FrameJob
  prev: KeepaliveNode | null
  next: KeepaliveNode | null
  /**
   * Nodes deleted during iteration are flagged rather than unlinked,
   * so the currently-running walk isn't disrupted. The walker skips
   * dead nodes and unlinks them opportunistically.
   */
  dead: boolean
}

interface PhaseQueue {
  /** Jobs to run on the next tick only. */
  jobs: FrameJob[]
  /** Head/tail of the keepalive linked list (insertion-ordered). */
  keepaliveHead: KeepaliveNode | null
  keepaliveTail: KeepaliveNode | null
  /** Fn -> node lookup for O(1) dedupe and cancel. */
  keepaliveLookup: Map<FrameJob, KeepaliveNode>
  /** Count of alive nodes. Kept in sync so empty-phase skip stays O(1). */
  keepaliveSize: number
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

  const makeQueue = (): PhaseQueue => ({
    jobs: [],
    keepaliveHead: null,
    keepaliveTail: null,
    keepaliveLookup: new Map(),
    keepaliveSize: 0,
  })

  const queues: Record<Phase, PhaseQueue> = {
    read: makeQueue(),
    compute: makeQueue(),
    update: makeQueue(),
    render: makeQueue(),
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
      const keepSize = q.keepaliveSize
      // Skip the whole phase when there's nothing to run. Avoids an
      // empty-array swap and an empty walk per empty phase, which in
      // steady state is 3 of 4 phases for a typical animation.
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
        // Walk the linked list. Nodes cancelled during this walk (e.g.
        // a finish handler removing itself) get flagged `dead` instead
        // of unlinked, so the walker's `next` pointer stays valid.
        // Dead nodes are unlinked here as we pass them — lazy compaction
        // keeps the register/cancel path branch-light.
        let node = q.keepaliveHead
        while (node !== null) {
          const next = node.next
          if (node.dead) {
            // Unlink.
            if (node.prev) node.prev.next = next
            else q.keepaliveHead = next
            if (next) next.prev = node.prev
            else q.keepaliveTail = node.prev
            node.prev = node.next = null
          } else {
            node.fn(state)
          }
          node = next
        }
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
        // Dedupe: registering the same fn twice is a no-op, matching
        // the old Set-based contract.
        if (q.keepaliveLookup.has(fn)) {
          wake()
          return
        }
        const node: KeepaliveNode = {
          fn,
          prev: q.keepaliveTail,
          next: null,
          dead: false,
        }
        if (q.keepaliveTail) q.keepaliveTail.next = node
        else q.keepaliveHead = node
        q.keepaliveTail = node
        q.keepaliveLookup.set(fn, node)
        q.keepaliveSize++
        keepCount++
      } else {
        q.jobs.push(fn)
        jobsCount++
      }
      wake()
    },
    cancel(phase, fn) {
      const q = queues[phase]
      const node = q.keepaliveLookup.get(fn)
      if (node !== undefined && !node.dead) {
        node.dead = true
        q.keepaliveLookup.delete(fn)
        q.keepaliveSize--
        keepCount--
      }
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
