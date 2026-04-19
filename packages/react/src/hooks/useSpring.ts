/**
 * `useSpring` returns a scalar value animated by a spring. It is
 * imperative by design: reading `.get()` or subscribing does not cause
 * re-renders. Drive DOM directly by attaching a subscriber, or bind to
 * a style via another hook.
 *
 *   const x = useSpring(0, { stiffness: 170 })
 *   x.set(100)                 // animate toward 100
 *   x.subscribe(v => ...)      // raf-frequency updates
 *
 * The spring restarts from the current value on each `set()`. The
 * underlying sampler is `springEasing` from the core package, so the
 * trajectory and settling behaviour match `spring()` used elsewhere.
 */

import { type SpringOpts, frame, springEasing } from "kinem"
import { useEffect, useMemo, useRef } from "react"

export interface SpringValue {
  /** Current value. Reading is synchronous; no re-render is triggered. */
  get(): number
  /** Start a spring from the current value to `target`. */
  set(target: number): void
  /** Instantly jump to `value` and cancel any in-flight animation. */
  jump(value: number): void
  /** Subscribe to value updates. Called on every rAF tick of the spring. */
  subscribe(fn: (value: number) => void): () => void
  /** Cancel any in-flight spring. The value stays at its current sample. */
  stop(): void
  /** True while a spring is in progress. */
  readonly isAnimating: boolean
}

interface Animation {
  readonly start: number
  readonly target: number
  readonly startTime: number
  readonly duration: number
  readonly easing: (p: number) => number
  tick: (state: { time: number }) => void
  cancel(): void
}

export function useSpring(initial: number, opts: SpringOpts = {}): SpringValue {
  const valueRef = useRef(initial)
  const animRef = useRef<Animation | null>(null)
  const subscribersRef = useRef<Set<(v: number) => void>>(new Set())
  const optsRef = useRef(opts)
  optsRef.current = opts

  const result = useMemo<SpringValue>(() => {
    const notify = (v: number): void => {
      for (const s of subscribersRef.current) s(v)
    }
    const cancelCurrent = (): void => {
      const a = animRef.current
      if (a) {
        a.cancel()
        animRef.current = null
      }
    }
    return {
      get() {
        return valueRef.current
      },
      jump(v: number) {
        cancelCurrent()
        valueRef.current = v
        notify(v)
      },
      set(target: number) {
        const start = valueRef.current
        if (start === target) {
          cancelCurrent()
          return
        }
        cancelCurrent()
        const easing = springEasing(optsRef.current)
        const duration = easing.duration
        let startTime = -1

        const tick: Animation["tick"] = (state) => {
          if (startTime < 0) startTime = state.time
          const elapsed = state.time - startTime
          const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1
          const v = start + (target - start) * easing(progress)
          valueRef.current = v
          notify(v)
          if (progress >= 1) {
            valueRef.current = target
            notify(target)
            animRef.current = null
            frame.cancel("update", tick)
          }
        }

        const anim: Animation = {
          start,
          target,
          startTime: 0,
          duration,
          easing,
          tick,
          cancel() {
            frame.cancel("update", tick)
          },
        }
        animRef.current = anim
        frame.schedule("update", tick, { keepalive: true })
      },
      subscribe(fn) {
        subscribersRef.current.add(fn)
        return () => {
          subscribersRef.current.delete(fn)
        }
      },
      stop() {
        cancelCurrent()
      },
      get isAnimating() {
        return animRef.current !== null
      },
    }
  }, [])

  useEffect(() => {
    return () => {
      const a = animRef.current
      if (a) a.cancel()
      animRef.current = null
      subscribersRef.current.clear()
    }
  }, [])

  return result
}
