/**
 * Pointer abstraction used by the gesture drivers.
 *
 * `PointerSource.bind()` subscribes to the pointer lifecycle on a given
 * element (down → move → up/cancel) and returns an unsubscribe
 * function. The DOM implementation also calls `setPointerCapture` on
 * pointerdown so move/up events continue to fire on the target even if
 * the pointer leaves it. Tests supply a synthetic source that emits
 * events directly; this keeps the gesture logic DOM-free.
 *
 * `createVelocityTracker` keeps a ring buffer of recent pointer samples
 * and returns a px/ms velocity over a configurable time window. Used
 * on pointer release to drive momentum / spring-back animations.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export interface PointerSample {
  readonly x: number
  readonly y: number
  readonly time: number
}

export interface PointerEventShim {
  readonly pointerId: number
  readonly pointerType: string
  readonly clientX: number
  readonly clientY: number
  readonly timeStamp: number
  preventDefault?(): void
}

export interface PointerHandlers {
  onStart?(ev: PointerEventShim): void
  onMove?(ev: PointerEventShim): void
  onEnd?(ev: PointerEventShim): void
  onCancel?(ev: PointerEventShim): void
}

export type PointerUnsubscribe = () => void

/**
 * Element shape this module needs: pointer capture plus add/remove
 * event listeners. Real `Element` satisfies this naturally; tests may
 * pass any compatible shim.
 */
export interface PointerBindTarget {
  setPointerCapture?(pointerId: number): void
  releasePointerCapture?(pointerId: number): void
  hasPointerCapture?(pointerId: number): boolean
  addEventListener(
    type: string,
    cb: (ev: PointerEventShim) => void,
    opts?: AddEventListenerOptions | boolean,
  ): void
  removeEventListener(type: string, cb: (ev: PointerEventShim) => void): void
}

export interface PointerSource {
  bind(el: PointerBindTarget, handlers: PointerHandlers): PointerUnsubscribe
}

export function createDomPointerSource(): PointerSource {
  return {
    bind(el, handlers) {
      const onStart = (ev: PointerEventShim): void => {
        el.setPointerCapture?.(ev.pointerId)
        handlers.onStart?.(ev)
      }
      const onMove = (ev: PointerEventShim): void => {
        handlers.onMove?.(ev)
      }
      const onEnd = (ev: PointerEventShim): void => {
        if (el.hasPointerCapture?.(ev.pointerId)) {
          el.releasePointerCapture?.(ev.pointerId)
        }
        handlers.onEnd?.(ev)
      }
      const onCancel = (ev: PointerEventShim): void => {
        if (el.hasPointerCapture?.(ev.pointerId)) {
          el.releasePointerCapture?.(ev.pointerId)
        }
        handlers.onCancel?.(ev)
      }

      el.addEventListener("pointerdown", onStart)
      el.addEventListener("pointermove", onMove)
      el.addEventListener("pointerup", onEnd)
      el.addEventListener("pointercancel", onCancel)

      return () => {
        el.removeEventListener("pointerdown", onStart)
        el.removeEventListener("pointermove", onMove)
        el.removeEventListener("pointerup", onEnd)
        el.removeEventListener("pointercancel", onCancel)
      }
    },
  }
}

export interface VelocityOpts {
  /** Time window in ms over which to compute velocity. Default 100. */
  readonly windowMs?: number
  /** Max samples retained in the ring buffer. Default 8. */
  readonly maxSamples?: number
}

export interface VelocityTracker {
  record(sample: PointerSample): void
  /**
   * Current velocity in px/ms. Computed as (latest - oldest in window)
   * divided by their time delta. Returns `{ x: 0, y: 0 }` if fewer than
   * two samples fall inside the window.
   */
  velocity(): Point
  reset(): void
}

export function createVelocityTracker(opts: VelocityOpts = {}): VelocityTracker {
  const windowMs = opts.windowMs ?? 100
  const max = opts.maxSamples ?? 8
  const samples: PointerSample[] = []

  return {
    record(sample) {
      samples.push(sample)
      if (samples.length > max) samples.shift()
    },
    velocity() {
      if (samples.length < 2) return { x: 0, y: 0 }
      const latest = samples[samples.length - 1]
      if (!latest) return { x: 0, y: 0 }
      const cutoff = latest.time - windowMs
      let oldest = latest
      for (let i = samples.length - 1; i >= 0; i--) {
        const s = samples[i]
        if (!s) continue
        if (s.time < cutoff) break
        oldest = s
      }
      const dt = latest.time - oldest.time
      if (dt <= 0) return { x: 0, y: 0 }
      return {
        x: (latest.x - oldest.x) / dt,
        y: (latest.y - oldest.y) / dt,
      }
    },
    reset() {
      samples.length = 0
    },
  }
}
