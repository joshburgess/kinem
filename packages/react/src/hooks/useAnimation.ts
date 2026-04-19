/**
 * `useAnimation` binds a vanilla `play()` controller to a React ref. The
 * hook itself performs no side effects on render; callers must call
 * `play(def)` (typically from an event handler or `useEffect`) to start.
 *
 * On unmount, the latest Controls handle is cancelled in an effect
 * cleanup. Calling `play()` with a second animation cancels the first
 * automatically so overlapping animations do not leak handles.
 */

import type {
  AnimationDef,
  AnimationProps,
  Controls,
  PlayOpts,
  StrategyState,
  StrategyTarget,
} from "@kinem/core"
import { play } from "@kinem/core"
import { useEffect, useMemo, useRef } from "react"

export interface UseAnimationResult<T extends Element = Element> {
  /** Attach to the element being animated. */
  readonly ref: (el: T | null) => void
  /** Play an `AnimationDef`. Cancels any in-flight animation first. */
  play(def: AnimationDef<AnimationProps>, opts?: PlayOpts): Controls
  pause(): void
  resume(): void
  seek(progress: number): void
  reverse(): void
  cancel(): void
  setSpeed(multiplier: number): void
  /** Live state of the most recent playback. `"idle"` if none has started. */
  readonly state: StrategyState
}

export function useAnimation<T extends Element = Element>(): UseAnimationResult<T> {
  const elRef = useRef<T | null>(null)
  const controlsRef = useRef<Controls | null>(null)

  const result = useMemo<UseAnimationResult<T>>(() => {
    const cancelCurrent = (): void => {
      const c = controlsRef.current
      if (c && c.state !== "cancelled" && c.state !== "finished") {
        c.cancel()
      }
    }
    return {
      ref(el) {
        elRef.current = el
      },
      play(def, opts) {
        const el = elRef.current
        if (!el) {
          throw new Error("useAnimation.play(): element ref is not attached yet")
        }
        cancelCurrent()
        const controls = play(def, [el as unknown as StrategyTarget], opts ?? {})
        controlsRef.current = controls
        return controls
      },
      pause() {
        controlsRef.current?.pause()
      },
      resume() {
        controlsRef.current?.resume()
      },
      seek(progress) {
        controlsRef.current?.seek(progress)
      },
      reverse() {
        controlsRef.current?.reverse()
      },
      cancel() {
        cancelCurrent()
      },
      setSpeed(multiplier) {
        const c = controlsRef.current
        if (c) c.speed = multiplier
      },
      get state() {
        return controlsRef.current?.state ?? "idle"
      },
    }
  }, [])

  useEffect(() => {
    return () => {
      const c = controlsRef.current
      if (c && c.state !== "cancelled" && c.state !== "finished") {
        c.cancel()
      }
      controlsRef.current = null
    }
  }, [])

  return result
}
