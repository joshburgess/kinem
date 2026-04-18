/**
 * Lazy-settleable `Promise<void>`. The underlying `Promise` is only
 * allocated on first access to `.promise`. If the owner calls resolve()
 * or reject() before anyone reads `.promise`, no Promise (and no
 * microtask) is ever scheduled.
 *
 * This is the hot path for fire-and-forget animations: create 1000
 * tweens, cancel them all before the first frame, never touch the
 * handle's `.finished`. GSAP pays zero promise cost here. With this
 * helper, motif also pays zero when the owner never inspects the
 * outcome.
 *
 * When `.promise` is accessed after a rejection, the returned promise
 * is pre-rejected and has a silent catch attached so it doesn't surface
 * as an unhandled rejection if the caller discards it. Callers that
 * chain (.then / .catch / await) still observe the rejection normally
 * because they create their own subscription to the same promise.
 */

const noop = (): void => {}

type LazyState = "pending" | "resolved" | "rejected"

export interface LazyPromise {
  resolve(): void
  reject(err: unknown): void
  /**
   * Mark as rejected with a standard "animation cancelled" Error. The
   * Error object is only allocated (and its stack captured) if/when
   * `.promise` is read. For fire-and-forget cancel patterns where the
   * handle's `finished` is never awaited, this pays zero.
   */
  rejectCancelled(): void
  readonly promise: Promise<void>
  readonly settled: boolean
}

export function createLazyPromise(): LazyPromise {
  let state: LazyState = "pending"
  let reason: unknown = undefined
  let wasCancelled = false
  let promise: Promise<void> | null = null
  let resolveFn: (() => void) | null = null
  let rejectFn: ((err: unknown) => void) | null = null

  return {
    resolve() {
      if (state !== "pending") return
      state = "resolved"
      resolveFn?.()
    },
    reject(err) {
      if (state !== "pending") return
      state = "rejected"
      reason = err
      rejectFn?.(err)
    },
    rejectCancelled() {
      if (state !== "pending") return
      state = "rejected"
      wasCancelled = true
      if (rejectFn) rejectFn(new Error("animation cancelled"))
    },
    get promise() {
      if (promise !== null) return promise
      if (state === "resolved") {
        promise = Promise.resolve()
      } else if (state === "rejected") {
        const err = wasCancelled ? new Error("animation cancelled") : reason
        promise = Promise.reject(err)
        promise.catch(noop)
      } else {
        promise = new Promise<void>((res, rej) => {
          resolveFn = res
          rejectFn = rej
        })
      }
      return promise
    },
    get settled() {
      return state !== "pending"
    },
  }
}
