/**
 * MotionValue is a tiny reactive cell. Subscribers are notified when
 * `set(v)` is called with a value that is not strictly equal to the
 * current one. It deliberately has no batching, no scheduling, and no
 * change detection beyond `Object.is`: the call site decides when to
 * update, and downstream consumers (renderers, transforms, components)
 * decide what to do with the notification.
 *
 * The cell also tracks the most recent `set` time per `performance.now`
 * so callers can compute velocity over a sliding window. Velocity is
 * lazy: it is only computed on demand via `getVelocity()`, never on
 * every set, so updating a value at 120 Hz costs one comparison and one
 * subscriber loop.
 *
 * Generic over `T` so the same primitive backs numbers, strings,
 * tuples, and arbitrary objects. For numeric values the velocity helper
 * is well-defined; for non-numeric values it always returns 0.
 */

export type MotionValueListener<T> = (value: T, prev: T) => void
export type Unsubscribe = () => void

export interface MotionValue<T> {
  /** Read the current value without subscribing. */
  get(): T
  /** Replace the value. Listeners fire iff the value actually changes. */
  set(value: T): void
  /**
   * Subscribe to value changes. The listener is NOT invoked
   * synchronously; the caller already knows the current value via
   * `get()`. Returns an unsubscribe function that is safe to call from
   * inside a listener.
   */
  on(listener: MotionValueListener<T>): Unsubscribe
  /**
   * Velocity (units per second) for numeric values, computed from the
   * two most recent samples. Returns 0 for non-numeric values, for the
   * first sample, or when more than `velocityWindowMs` has elapsed
   * since the last update (stale).
   */
  getVelocity(): number
  /**
   * Tear down the cell: clears all listeners. Subsequent `set` calls
   * are no-ops on the listener set, but still update the value.
   */
  destroy(): void
}

interface MotionValueState<T> {
  value: T
  prevValue: T | undefined
  prevTime: number | undefined
  lastTime: number | undefined
  listeners: Set<MotionValueListener<T>>
}

const VELOCITY_WINDOW_MS = 30

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

export function motionValue<T>(initial: T): MotionValue<T> {
  const state: MotionValueState<T> = {
    value: initial,
    prevValue: undefined,
    prevTime: undefined,
    lastTime: undefined,
    listeners: new Set(),
  }

  return {
    get(): T {
      return state.value
    },
    set(next: T): void {
      const prev = state.value
      if (Object.is(prev, next)) return
      state.prevValue = prev
      state.prevTime = state.lastTime
      state.lastTime = now()
      state.value = next
      if (state.listeners.size === 0) return
      // Snapshot to tolerate add/remove during dispatch.
      const snapshot = Array.from(state.listeners)
      for (let i = 0; i < snapshot.length; i++) {
        snapshot[i]!(next, prev)
      }
    },
    on(listener: MotionValueListener<T>): Unsubscribe {
      state.listeners.add(listener)
      return () => {
        state.listeners.delete(listener)
      }
    },
    getVelocity(): number {
      if (typeof state.value !== "number") return 0
      if (state.prevValue === undefined || state.prevTime === undefined) return 0
      if (state.lastTime === undefined) return 0
      const elapsed = state.lastTime - state.prevTime
      if (elapsed <= 0) return 0
      const sinceLast = now() - state.lastTime
      if (sinceLast > VELOCITY_WINDOW_MS) return 0
      const v = state.value as unknown as number
      const p = state.prevValue as unknown as number
      return ((v - p) / elapsed) * 1000
    },
    destroy(): void {
      state.listeners.clear()
    },
  }
}

/** Convenience: bridge a MotionValue to a CSS variable on an element. */
export function bindMotionValueToCss<T>(
  mv: MotionValue<T>,
  el: { style: { setProperty(name: string, value: string): void } },
  cssVarName: string,
  format: (value: T) => string = (v) => String(v),
): Unsubscribe {
  el.style.setProperty(cssVarName, format(mv.get()))
  return mv.on((value) => {
    el.style.setProperty(cssVarName, format(value))
  })
}
