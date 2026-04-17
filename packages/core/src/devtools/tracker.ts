/**
 * Lightweight runtime tracker for every `play()` invocation.
 *
 * The tracker is a process-wide singleton that records each
 * `Controls` returned by `play()` along with its targets and start
 * time. Records are removed on `finished` / `cancel`. Subscribers are
 * notified on start / finish / cancel events.
 *
 * The hot path is free when nothing is subscribed: the tracker always
 * maintains the active map (so `listActive()` works without any prior
 * setup) but event emission short-circuits on empty listener sets.
 *
 * The tracker lives in core so every animation is visible regardless
 * of framework adapter. The `devtools` package consumes it; tests use
 * `__resetTracker()` to avoid cross-test leakage.
 */

import type { Controls } from "../api/controls"
import type { StrategyBackend, StrategyState, StrategyTarget } from "../render/strategy"

export interface AnimationRecord {
  readonly id: number
  readonly duration: number
  readonly targets: readonly StrategyTarget[]
  readonly startedAt: number
  readonly state: StrategyState
  /** Rendering backend the play() call requested (auto/waapi/raf). */
  readonly backend: StrategyBackend
  /**
   * Wall-clock elapsed ratio in [0, 1]. Not adjusted for pause or
   * seek, so treat this as a rough indicator rather than ground truth.
   * For exact timing, read from the strategy handle.
   */
  readonly progress: number
  /** Live Controls handle. Useful for devtools that need to pause/seek. */
  readonly controls: Controls
}

export type TrackerEvent =
  | { readonly type: "start"; readonly id: number; readonly record: AnimationRecord }
  | { readonly type: "finish"; readonly id: number }
  | { readonly type: "cancel"; readonly id: number }

export type TrackerListener = (event: TrackerEvent) => void

let nextId = 1
const active = new Map<number, AnimationRecord>()
const listeners = new Set<TrackerListener>()

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function emit(event: TrackerEvent): void {
  if (listeners.size === 0) return
  for (const fn of listeners) fn(event)
}

/**
 * Register a `Controls` with the tracker. Returns the allocated id.
 * Called from `play()`; user code should not invoke this directly.
 */
export function trackAnimation(
  controls: Controls,
  targets: readonly StrategyTarget[],
  backend: StrategyBackend = "auto",
): number {
  const id = nextId++
  const startedAt = now()
  const record: AnimationRecord = {
    id,
    duration: controls.duration,
    targets,
    startedAt,
    backend,
    controls,
    get state() {
      return controls.state
    },
    get progress() {
      if (controls.duration <= 0) return 1
      const elapsed = now() - startedAt
      const p = elapsed / controls.duration
      return p < 0 ? 0 : p > 1 ? 1 : p
    },
  }
  active.set(id, record)
  emit({ type: "start", id, record })
  controls.finished.then(
    () => {
      if (active.delete(id)) emit({ type: "finish", id })
    },
    () => {
      if (active.delete(id)) emit({ type: "cancel", id })
    },
  )
  return id
}

/** Snapshot of currently-active animations. Order is insertion (oldest first). */
export function listActive(): readonly AnimationRecord[] {
  return Array.from(active.values())
}

/** Subscribe to tracker events. Returns an unsubscribe function. */
export function subscribe(fn: TrackerListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Test-only: reset the tracker state so tests don't leak into each other. */
export function __resetTracker(): void {
  active.clear()
  listeners.clear()
  nextId = 1
}
