/**
 * `inView()` is a tiny IntersectionObserver wrapper. It calls
 * `enter(entry)` the first time the element crosses the visibility
 * threshold and (unless `once: true`) `leave(entry)` the next time it
 * leaves. The returned function unobserves and disconnects.
 *
 *   const stop = inView(el, (entry) => {
 *     play(fadeIn, [entry.target])
 *     return () => play(fadeOut, [entry.target])
 *   })
 *
 * The callback may return a `leave` cleanup function that fires on the
 * next exit; this matches the React `useEffect` style without forcing
 * adapters to allocate a second listener.
 *
 * If `IntersectionObserver` is not available (SSR, very old browsers),
 * the helper logs nothing, calls `enter` synchronously with `null`
 * (treating "we can't tell" as "in view"), and returns a no-op stop.
 * This makes server-side renders match the optimistic visible state and
 * prevents content from being permanently hidden.
 */

export interface InViewEntry {
  readonly target: Element
  readonly isIntersecting: boolean
  readonly intersectionRatio: number
  readonly boundingClientRect: DOMRectReadOnly
  readonly rootBounds: DOMRectReadOnly | null
  readonly time: number
}

export interface InViewOpts {
  /** Trigger only the first entry; never observe again. Default false. */
  readonly once?: boolean
  /** IntersectionObserver `root`. */
  readonly root?: Element | Document | null
  /** IntersectionObserver `rootMargin` (e.g. "0px 0px -10% 0px"). */
  readonly rootMargin?: string
  /**
   * Visibility ratio at which `enter` fires.
   *  - "some" (default): any pixel visible (threshold 0)
   *  - "all": fully visible (threshold 1)
   *  - number in [0, 1]: explicit threshold
   */
  readonly amount?: "some" | "all" | number
}

export type InViewLeave = (entry: InViewEntry | null) => void
export type InViewEnter = (entry: InViewEntry) => InViewLeave | undefined
export type InViewStop = () => void

const NULL_ENTRY = (target: Element): InViewEntry => ({
  target,
  isIntersecting: true,
  intersectionRatio: 1,
  boundingClientRect: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  },
  rootBounds: null,
  time: 0,
})

const resolveThreshold = (amount: InViewOpts["amount"]): number => {
  if (amount === "all") return 1
  if (typeof amount === "number") {
    if (amount < 0) return 0
    if (amount > 1) return 1
    return amount
  }
  return 0
}

export function inView(target: Element, enter: InViewEnter, opts: InViewOpts = {}): InViewStop {
  if (typeof IntersectionObserver === "undefined") {
    // Optimistic fallback: treat as visible. The user's `enter` may
    // start an animation; we don't wire `leave` because there's no
    // way to detect exit without an observer.
    enter(NULL_ENTRY(target))
    return () => {}
  }

  const threshold = resolveThreshold(opts.amount)
  let leave: InViewLeave | undefined
  let entered = false

  const init: IntersectionObserverInit = { threshold }
  if (opts.root !== undefined) init.root = opts.root
  if (opts.rootMargin !== undefined) init.rootMargin = opts.rootMargin

  const observer = new IntersectionObserver((entries) => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!
      if (e.isIntersecting && !entered) {
        entered = true
        const result = enter({
          target: e.target,
          isIntersecting: e.isIntersecting,
          intersectionRatio: e.intersectionRatio,
          boundingClientRect: e.boundingClientRect,
          rootBounds: e.rootBounds,
          time: e.time,
        })
        if (typeof result === "function") leave = result
        if (opts.once) {
          observer.disconnect()
          return
        }
      } else if (!e.isIntersecting && entered) {
        entered = false
        if (leave) {
          leave({
            target: e.target,
            isIntersecting: e.isIntersecting,
            intersectionRatio: e.intersectionRatio,
            boundingClientRect: e.boundingClientRect,
            rootBounds: e.rootBounds,
            time: e.time,
          })
          leave = undefined
        }
      }
    }
  }, init)

  observer.observe(target)

  return () => {
    observer.disconnect()
    if (leave) {
      leave(null)
      leave = undefined
    }
  }
}
