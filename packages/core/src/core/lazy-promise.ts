/**
 * Lazy-settleable `Promise<void>`. The underlying `Promise` is only
 * allocated on first access to `.promise`. If the owner calls resolve()
 * or reject() before anyone reads `.promise`, no Promise (and no
 * microtask) is ever scheduled.
 *
 * This is the hot path for fire-and-forget animations: create 1000
 * tweens, cancel them all before the first frame, never touch the
 * handle's `.finished`. GSAP pays zero promise cost here. With this
 * helper, kinem also pays zero when the owner never inspects the
 * outcome.
 *
 * When `.promise` is accessed after a rejection, the returned promise
 * is pre-rejected and has a silent catch attached so it doesn't surface
 * as an unhandled rejection if the caller discards it. Callers that
 * chain (.then / .catch / await) still observe the rejection normally
 * because they create their own subscription to the same promise.
 *
 * Implemented as a class so the five public operations live on the
 * prototype once rather than being reallocated as fresh closures per
 * `createLazyPromise()` call. Each animation constructs one of these,
 * so at n=1000 plays that's 5000 fewer closure allocs per cycle.
 */

const noop = (): void => {}
const CANCELLED_MSG = "animation cancelled"
// Shared, frozen Error instance used for all `rejectCancelled()` paths.
// The alternative (one `new Error` per cancel) allocates a fresh object
// and captures a stack on every call. The stack is captured at
// construction time, not at the cancel call site, so it points into
// this module regardless: callers reading `.stack` get no useful
// debugging signal either way. Frozen so a consumer that accidentally
// mutates a caught cancel error can't leak state across rejections.
// Significant on the hot path: at n=1000 plays that's 1000 fewer Error
// allocs + stack captures per startup-commit cycle.
const CANCELLED_ERROR: Error = Object.freeze(new Error(CANCELLED_MSG)) as Error

type LazyState = "pending" | "resolved" | "rejected"

export interface LazyPromise {
  resolve(): void
  reject(err: unknown): void
  /**
   * Mark as rejected with a standard "animation cancelled" Error. A
   * single module-level frozen Error is reused across every call; no
   * allocation or stack capture happens per cancel. For fire-and-forget
   * cancel patterns where the handle's `finished` is never awaited,
   * this still pays zero (no Promise either).
   */
  rejectCancelled(): void
  readonly promise: Promise<void>
  readonly settled: boolean
}

class LazyPromiseImpl implements LazyPromise {
  #state: LazyState = "pending"
  #reason: unknown = undefined
  #wasCancelled = false
  #promise: Promise<void> | null = null
  #resolveFn: (() => void) | null = null
  #rejectFn: ((err: unknown) => void) | null = null

  resolve(): void {
    if (this.#state !== "pending") return
    this.#state = "resolved"
    this.#resolveFn?.()
  }

  reject(err: unknown): void {
    if (this.#state !== "pending") return
    this.#state = "rejected"
    this.#reason = err
    this.#rejectFn?.(err)
  }

  rejectCancelled(): void {
    if (this.#state !== "pending") return
    this.#state = "rejected"
    this.#wasCancelled = true
    if (this.#rejectFn) this.#rejectFn(CANCELLED_ERROR)
  }

  get promise(): Promise<void> {
    if (this.#promise !== null) return this.#promise
    if (this.#state === "resolved") {
      this.#promise = Promise.resolve()
    } else if (this.#state === "rejected") {
      const err = this.#wasCancelled ? CANCELLED_ERROR : this.#reason
      this.#promise = Promise.reject(err)
      this.#promise.catch(noop)
    } else {
      this.#promise = new Promise<void>((res, rej) => {
        this.#resolveFn = res
        this.#rejectFn = rej
      })
    }
    return this.#promise
  }

  get settled(): boolean {
    return this.#state !== "pending"
  }
}

export function createLazyPromise(): LazyPromise {
  return new LazyPromiseImpl()
}
