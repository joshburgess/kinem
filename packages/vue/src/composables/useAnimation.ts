/**
 * `useAnimation` binds a vanilla `play()` controller to a Vue template
 * ref. The composable itself performs no side effects on setup; callers
 * must call `play(def)` (typically from an event handler or
 * `onMounted`) to start.
 *
 *   const { ref, play } = useAnimation<HTMLElement>()
 *   play(tween({ opacity: [0, 1] }, { duration: 400 }))
 *
 * On `onBeforeUnmount`, the latest Controls handle is cancelled.
 * Calling `play()` with a second animation cancels the first
 * automatically so overlapping animations do not leak handles.
 */

import type {
  AnimationDef,
  AnimationProps,
  Controls,
  PlayOpts,
  StrategyState,
  StrategyTarget,
} from "motif-animate"
import { play as playCore } from "motif-animate"
import { type ShallowRef, onBeforeUnmount, shallowRef } from "vue"

export interface UseAnimationResult<T extends Element = Element> {
  /** Attach to the element being animated via `ref`. */
  readonly ref: ShallowRef<T | null>
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
  const elRef: ShallowRef<T | null> = shallowRef(null)
  let current: Controls | null = null

  const cancelCurrent = (): void => {
    if (current && current.state !== "cancelled" && current.state !== "finished") {
      current.cancel()
    }
  }

  onBeforeUnmount(() => {
    cancelCurrent()
    current = null
  })

  return {
    ref: elRef,
    play(def, opts) {
      const el = elRef.value
      if (!el) {
        throw new Error("useAnimation.play(): element ref is not attached yet")
      }
      cancelCurrent()
      current = playCore(def, [el as unknown as StrategyTarget], opts ?? {})
      return current
    },
    pause() {
      current?.pause()
    },
    resume() {
      current?.resume()
    },
    seek(progress) {
      current?.seek(progress)
    },
    reverse() {
      current?.reverse()
    },
    cancel() {
      cancelCurrent()
    },
    setSpeed(multiplier) {
      if (current) current.speed = multiplier
    },
    get state() {
      return current?.state ?? "idle"
    },
  }
}
