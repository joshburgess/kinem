/**
 * Leader-follower chain: a sequence of elements that lerp toward
 * whichever element comes before them, producing a tail-following
 * effect. Used for cursor trails, rope-like motion, snake-style
 * follower lattices.
 */

export interface FollowTarget {
  readonly style: { setProperty(name: string, value: string): void }
}

export type RafLike = (cb: (time: number) => void) => number

export interface FollowOpts {
  /**
   * Per-link "tightness" in [0, 1]. Higher = followers track the leader
   * more closely. Default 0.32.
   */
  readonly stiffness?: number
  /**
   * Per-link decay applied to stiffness as we move down the chain. The
   * effective stiffness for follower `i` is `stiffness * decay^i`.
   * Default 0.86.
   */
  readonly decay?: number
  /**
   * Optional custom commit per follower. Receives (target, x, y, idx).
   * If omitted, writes `transform: translate3d(x, y, 0)` so followers
   * stay GPU-composited.
   */
  readonly commit?: (target: FollowTarget, x: number, y: number, idx: number) => void
  /** Override raf for testing. */
  readonly raf?: RafLike
  /** Override cancelAnimationFrame for testing. */
  readonly cancelRaf?: (id: number) => void
}

export interface FollowHandle {
  cancel(): void
  /** Set the leader's current position. Followers chase this each frame. */
  setLeader(x: number, y: number): void
  /** Snap all followers to (x, y) immediately. Useful on init. */
  snapTo(x: number, y: number): void
  readonly state: "active" | "cancelled"
}

const DEFAULT_STIFFNESS = 0.32
const DEFAULT_DECAY = 0.86

function defaultCommit(target: FollowTarget, x: number, y: number): void {
  target.style.setProperty("transform", `translate3d(${x}px, ${y}px, 0)`)
}

/**
 * Build a leader-follower chain. Drive the leader with `setLeader(x, y)`
 * (typically from a `pointermove` handler or a parent animation's
 * onProgress); followers lerp toward the previous link each frame.
 *
 * ```ts
 * const chain = follow(blobs, { stiffness: 0.32, decay: 0.86 })
 * window.addEventListener("pointermove", e =>
 *   chain.setLeader(e.clientX, e.clientY)
 * )
 * ```
 */
export function follow(targets: readonly FollowTarget[], opts: FollowOpts = {}): FollowHandle {
  const stiffness = opts.stiffness ?? DEFAULT_STIFFNESS
  const decay = opts.decay ?? DEFAULT_DECAY
  const raf: RafLike =
    opts.raf ??
    (typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame.bind(globalThis)
      : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number)
  const cancelRaf =
    opts.cancelRaf ??
    (typeof cancelAnimationFrame !== "undefined"
      ? cancelAnimationFrame.bind(globalThis)
      : (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>))
  const commit = opts.commit ?? defaultCommit

  const xs = new Array<number>(targets.length).fill(0)
  const ys = new Array<number>(targets.length).fill(0)
  let leaderX = 0
  let leaderY = 0
  let state: "active" | "cancelled" = "active"

  const stiffnesses = new Array<number>(targets.length)
  for (let i = 0; i < targets.length; i++) {
    stiffnesses[i] = Math.min(1, Math.max(0, stiffness * decay ** i))
  }

  let rafId = 0
  const tick = (): void => {
    if (state === "cancelled") return
    let prevX = leaderX
    let prevY = leaderY
    for (let i = 0; i < targets.length; i++) {
      const k = stiffnesses[i] as number
      const cx = (xs[i] as number) + (prevX - (xs[i] as number)) * k
      const cy = (ys[i] as number) + (prevY - (ys[i] as number)) * k
      xs[i] = cx
      ys[i] = cy
      const t = targets[i] as FollowTarget
      commit(t, cx, cy, i)
      prevX = cx
      prevY = cy
    }
    rafId = raf(tick)
  }

  rafId = raf(tick)

  return {
    setLeader(x, y) {
      leaderX = x
      leaderY = y
    },
    snapTo(x, y) {
      leaderX = x
      leaderY = y
      for (let i = 0; i < targets.length; i++) {
        xs[i] = x
        ys[i] = y
        commit(targets[i] as FollowTarget, x, y, i)
      }
    },
    cancel() {
      state = "cancelled"
      cancelRaf(rafId)
    },
    get state() {
      return state
    },
  }
}
