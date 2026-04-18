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
  readonly promise: Promise<void>
  readonly settled: boolean
}

export function createLazyPromise(): LazyPromise {
  let state: LazyState = "pending"
  let reason: unknown = undefined
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
    get promise() {
      if (promise !== null) return promise
      if (state === "resolved") {
        promise = Promise.resolve()
      } else if (state === "rejected") {
        promise = Promise.reject(reason)
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
