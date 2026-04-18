/**
 * Shared animation state machine used by both the DOM rAF backend and
 * non-DOM drivers (canvas, WebGL). Owns progress tracking, pause/
 * resume/seek/reverse/speed, and the finished promise. The caller
 * plugs in a `commit(values)` callback that does whatever rendering
 * the surface needs: applying DOM properties, drawing to a canvas, or
 * uploading a uniform.
 *
 * Extracting this into a dedicated helper keeps playRaf and playCanvas
 * from duplicating ~150 lines of timing logic. The contract is
 * minimal: the state machine never touches the commit function's
 * arguments, so surfaces can use whatever `PropertyValue`-shaped
 * output their `AnimationDef` produces.
 */

import { createLazyPromise } from "../core/lazy-promise"
import type { AnimationDef } from "../core/types"
import { type Clock, createClock } from "../scheduler/clock"
import { type FrameScheduler, frame as defaultFrame } from "../scheduler/frame"

export type TimingState = "idle" | "playing" | "paused" | "finished" | "cancelled"

export interface TimingHandle {
  pause(): void
  resume(): void
  /** Seek to `progress` in [0, 1]. Does not change play/pause state. */
  seek(progress: number): void
  /** Flip the playback direction. May resume a finished animation. */
  reverse(): void
  /** Set clock speed multiplier; must be > 0. */
  setSpeed(multiplier: number): void
  cancel(): void
  readonly state: TimingState
  readonly progress: number
  readonly direction: 1 | -1
  readonly finished: Promise<void>
}

export interface TimingOpts {
  readonly scheduler?: FrameScheduler
  readonly clock?: Clock
  readonly repeat?: boolean
  readonly onFinish?: () => void
}

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

/**
 * Build a `TimingHandle` that drives `def.interpolate(progress)` and
 * calls `commit(values)` whenever a new frame should be rendered.
 */
export function createTiming<V>(
  def: AnimationDef<V>,
  commit: (values: V) => void,
  opts: TimingOpts = {},
): TimingHandle {
  const scheduler = opts.scheduler ?? defaultFrame
  const clock = opts.clock ?? createClock()
  clock.reset()

  const duration = def.duration
  if (!(duration > 0) || !Number.isFinite(duration)) {
    throw new Error(`createTiming(): animation duration must be finite and > 0 (got ${duration})`)
  }

  let state: TimingState = "playing"
  let direction: 1 | -1 = 1
  let anchorProgress = 0
  let anchorTime = 0
  let progress = 0
  let needsRender = true

  const lp = createLazyPromise()

  const computeProgress = (): number => {
    const elapsed = (clock.now() - anchorTime) / duration
    const raw = anchorProgress + direction * elapsed
    if (opts.repeat) {
      const r = ((raw % 1) + 1) % 1
      return r
    }
    return clamp01(raw)
  }

  const render = (): void => {
    commit(def.interpolate(progress))
  }

  const armKeepalive = (): void => {
    scheduler.schedule("compute", tickCompute, { keepalive: true })
    scheduler.schedule("update", tickUpdate, { keepalive: true })
  }

  const disarm = (): void => {
    scheduler.cancel("compute", tickCompute)
    scheduler.cancel("update", tickUpdate)
  }

  const isFinished = (p: number): boolean => {
    if (opts.repeat) return false
    return (direction === 1 && p >= 1) || (direction === -1 && p <= 0)
  }

  const tickCompute = (): void => {
    if (state !== "playing") return
    progress = computeProgress()
    needsRender = true
    if (isFinished(progress)) {
      progress = direction === 1 ? 1 : 0
      render()
      state = "finished"
      disarm()
      opts.onFinish?.()
      lp.resolve()
    }
  }

  const tickUpdate = (): void => {
    if (!needsRender) return
    render()
    needsRender = false
    if (state === "paused") disarm()
  }

  const rebase = (): void => {
    anchorProgress = progress
    anchorTime = clock.now()
  }

  armKeepalive()

  return {
    pause() {
      if (state !== "playing") return
      progress = computeProgress()
      clock.pause()
      rebase()
      state = "paused"
      needsRender = true
    },
    resume() {
      if (state !== "paused") return
      clock.resume()
      rebase()
      state = "playing"
      armKeepalive()
    },
    seek(p: number) {
      if (state === "cancelled") return
      const clamped = clamp01(p)
      progress = clamped
      rebase()
      needsRender = true
      if (state === "finished" && !isFinished(clamped)) {
        state = "playing"
        armKeepalive()
      } else if (state === "paused") {
        scheduler.schedule("update", tickUpdate)
      }
    },
    reverse() {
      if (state === "cancelled") return
      progress = computeProgress()
      rebase()
      direction = (direction === 1 ? -1 : 1) as 1 | -1
      needsRender = true
      if (state === "finished" && !isFinished(progress)) {
        state = "playing"
        armKeepalive()
      } else if (state === "paused") {
        scheduler.schedule("update", tickUpdate)
      }
    },
    setSpeed(multiplier: number) {
      if (state === "cancelled") return
      if (state === "playing") progress = computeProgress()
      rebase()
      clock.setSpeed(multiplier)
    },
    cancel() {
      if (state === "finished" || state === "cancelled") return
      state = "cancelled"
      disarm()
      lp.reject(new Error("animation cancelled"))
    },
    get state() {
      return state
    },
    get progress() {
      return progress
    },
    get direction() {
      return direction
    },
    get finished() {
      return lp.promise
    },
  }
}
