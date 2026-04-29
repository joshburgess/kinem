/**
 * `createAnimation` binds a vanilla `play()` controller to a Solid ref.
 * The primitive itself performs no side effects on creation; callers
 * must call `play(def)` (typically from an event handler or `onMount`)
 * to start.
 *
 * On `onCleanup`, the latest Controls handle is cancelled. Calling
 * `play()` with a new animation cancels the previous one first so
 * overlapping animations do not leak handles.
 */

import {
  type AnimationDef,
  type AnimationProps,
  type Controls,
  type PlayOpts,
  type StrategyState,
  type StrategyTarget,
  play,
} from "@kinem/core"
import { onCleanup } from "solid-js"

export interface CreateAnimationResult<T extends Element = Element> {
  /** Attach to the element being animated via `ref={x.ref}`. */
  ref(el: T): void
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

export function createAnimation<T extends Element = Element>(): CreateAnimationResult<T> {
  let el: T | null = null
  let controls: Controls | null = null

  const cancelCurrent = (): void => {
    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }
  }

  onCleanup(() => {
    cancelCurrent()
    controls = null
  })

  return {
    ref(node) {
      el = node
    },
    play(def, opts) {
      if (!el) {
        throw new Error("createAnimation.play(): element ref is not attached yet")
      }
      cancelCurrent()
      controls = play(def, [el as unknown as StrategyTarget], opts ?? {})
      return controls
    },
    pause() {
      controls?.pause()
    },
    resume() {
      controls?.resume()
    },
    seek(progress) {
      controls?.seek(progress)
    },
    reverse() {
      controls?.reverse()
    },
    cancel() {
      cancelCurrent()
    },
    setSpeed(multiplier) {
      if (controls) controls.speed = multiplier
    },
    get state() {
      return controls?.state ?? ("idle" as StrategyState)
    },
  }
}
