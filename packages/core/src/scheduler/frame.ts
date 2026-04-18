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
 * Keepalive has two call shapes:
 *   - fn-based: `schedule(phase, fn, { keepalive: true })` +
 *     `cancel(phase, fn)`. The scheduler internally allocates a
 *     wrapper node per registration and keeps a `Map<fn, node>` for
 *     lookup on cancel. Convenient for ad-hoc callers.
 *   - node-based: `scheduleNode(phase, node)` + `cancelNode(node)`,
 *     where `node` implements `KeepaliveNode`. No wrapper alloc, no
 *     Map lookup. The caller's object IS the linked-list node. Used
 *     by hot-path classes (the animation-timing loop) where one node
 *     is allocated per play and we don't want any extras.
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
 * A node in the keepalive list. Consumers can implement this directly
 * on their hot-path class to avoid the wrapper-node + Map-lookup
 * allocation that `schedule(phase, fn, { keepalive: true })` pays per
 * registration. The `_ka*` fields are scheduler-owned. Consumers must
 * initialize them to the values shown below and never write to them
 * afterwards.
 *
 * State machine:
 *   (phase=null, dead=false)   not linked (initial)
 *   (phase=X,    dead=false)   linked and alive
 *   (phase=X,    dead=true)    linked but cancelled (awaiting unlink)
 * The walker unlinks dead nodes when it reaches them, at which point
 * the node returns to the "not linked" state and can be re-registered.
 */
export interface KeepaliveNode {
  _kaPrev: KeepaliveNode | null
  _kaNext: KeepaliveNode | null
  _kaPhase: Phase | null
  _kaDead: boolean
  _kaTick(state: FrameState): void
}

/**
 * Internal adapter for the fn-based keepalive API. One instance
 * allocated per `schedule(phase, fn, { keepalive: true })` call.
 * External callers that want zero wrapper overhead should implement
 * `KeepaliveNode` directly and use `scheduleNode`/`cancelNode`.
 */
class FnNode implements KeepaliveNode {
  _kaPrev: KeepaliveNode | null = null
  _kaNext: KeepaliveNode | null = null
  _kaPhase: Phase | null = null
  _kaDead = false
  constructor(public fn: FrameJob) {}
  _kaTick(state: FrameState): void {
    this.fn(state)
  }
}

interface PhaseQueue {
  /** Jobs to run on the next tick only. */
  jobs: FrameJob[]
  /** Head/tail of the keepalive linked list (insertion-ordered). */
  head: KeepaliveNode | null
  tail: KeepaliveNode | null
  /** fn -> FnNode lookup for the fn-based API (O(1) dedupe + cancel). */
  fnLookup: Map<FrameJob, FnNode>
  /** Count of alive (non-dead) nodes. Kept in sync so empty-phase skip stays O(1). */
  size: number
}

export interface FrameScheduler {
  /** Enqueue `fn` to run in `phase` on the next frame. */
  schedule(phase: Phase, fn: FrameJob, opts?: { keepalive?: boolean }): void
  /** Remove a keepalive fn. No-op if the fn is not registered. */
  cancel(phase: Phase, fn: FrameJob): void
  /**
   * Link a KeepaliveNode into `phase`'s keepalive list. No-op if the
   * node is already linked in the same phase (dedupe). Reviving a
   * dead-but-still-linked node un-dies it in place (preserves list
   * position).
   */
  scheduleNode(phase: Phase, node: KeepaliveNode): void
  /** Unlink a KeepaliveNode. No-op if the node is not registered. */
  cancelNode(node: KeepaliveNode): void
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
    head: null,
    tail: null,
    fnLookup: new Map(),
    size: 0,
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
  // alive keepalive registrations. `hasWork()` is
  // `(jobsCount + keepCount) > 0`.
  let jobsCount = 0
  let keepCount = 0

  const hasWork = (): boolean => jobsCount + keepCount > 0

  const linkAtTail = (q: PhaseQueue, node: KeepaliveNode, phase: Phase): void => {
    node._kaPhase = phase
    node._kaDead = false
    node._kaPrev = q.tail
    node._kaNext = null
    if (q.tail) q.tail._kaNext = node
    else q.head = node
    q.tail = node
    q.size++
    keepCount++
  }

  const runTick = (time: number): FrameState => {
    const delta = lastTime < 0 ? 0 : time - lastTime
    lastTime = time
    const state: FrameState = { time, delta, tick: tickIndex }

    for (const phase of PHASES) {
      const q = queues[phase]
      const jobsLen = q.jobs.length
      const keepSize = q.size
      // Skip the whole phase when there's nothing to run.
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
        // Walk the linked list. Nodes cancelled during this walk get
        // marked `dead`; the walker unlinks dead nodes it encounters,
        // so the `next` pointer for the current cursor stays valid.
        let node = q.head
        while (node !== null) {
          const next = node._kaNext
          if (node._kaDead) {
            // Unlink, then reset so the node can be re-registered.
            if (node._kaPrev) node._kaPrev._kaNext = next
            else q.head = next
            if (next) next._kaPrev = node._kaPrev
            else q.tail = node._kaPrev
            node._kaPrev = null
            node._kaNext = null
            node._kaPhase = null
            node._kaDead = false
          } else {
            node._kaTick(state)
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

  const cancelRafIfIdle = (): void => {
    if (!hasWork() && rafId !== null) {
      raf.cancel(rafId)
      rafId = null
      lastTime = -1
    }
  }

  const scheduleNode = (phase: Phase, node: KeepaliveNode): void => {
    if (node._kaPhase !== null) {
      // Already linked. Enforce same-phase (migrating across phases
      // is out of scope). If dead-but-linked, revive in place.
      if (node._kaPhase !== phase) return
      if (node._kaDead) {
        node._kaDead = false
        queues[phase].size++
        keepCount++
      }
      wake()
      return
    }
    linkAtTail(queues[phase], node, phase)
    wake()
  }

  const cancelNode = (node: KeepaliveNode): void => {
    if (node._kaPhase === null || node._kaDead) return
    node._kaDead = true
    queues[node._kaPhase].size--
    keepCount--
    cancelRafIfIdle()
  }

  return {
    schedule(phase, fn, o) {
      const q = queues[phase]
      if (o?.keepalive) {
        const existing = q.fnLookup.get(fn)
        if (existing !== undefined) {
          // Same fn: dedupe. Revive if dead, else no-op.
          if (existing._kaDead) {
            existing._kaDead = false
            q.size++
            keepCount++
          }
          wake()
          return
        }
        const node = new FnNode(fn)
        q.fnLookup.set(fn, node)
        linkAtTail(q, node, phase)
        wake()
      } else {
        q.jobs.push(fn)
        jobsCount++
        wake()
      }
    },
    cancel(phase, fn) {
      const q = queues[phase]
      const node = q.fnLookup.get(fn)
      if (node !== undefined && !node._kaDead) {
        node._kaDead = true
        q.fnLookup.delete(fn)
        q.size--
        keepCount--
        cancelRafIfIdle()
      }
    },
    scheduleNode,
    cancelNode,
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
