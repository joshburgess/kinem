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
/**
 * Opt-in flag. When false (the default), `trackAnimation()` is a no-op
 * and `play()` pays nothing for the devtools integration. The devtools
 * package flips this on at import time via `enableTracker()`, so any
 * app that imports devtools gets full tracking automatically.
 *
 * One-way switch by design: enabling mid-session is fine, but we don't
 * support flipping off because in-flight animations already have their
 * `finished` continuations wired up. Toggling back and forth would
 * leave the active map inconsistent with reality.
 */
let enabled = false

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
 * Surface the tracker on a well-known global so external tools (the
 * Chrome DevTools extension in particular) can connect without
 * bundling `@kinem/core`. Mirrors the `__REACT_DEVTOOLS_GLOBAL_HOOK__`
 * pattern: a single namespaced slot with a small, stable API. Installed
 * idempotently the first time tracking is enabled in a browser.
 */
export interface KinemDevtoolsHook {
  readonly version: 1
  listActive(): readonly AnimationRecord[]
  subscribe(fn: TrackerListener): () => void
}

function installHook(): void {
  const g =
    typeof globalThis !== "undefined"
      ? (globalThis as { __KINEM_DEVTOOLS_HOOK__?: KinemDevtoolsHook })
      : undefined
  if (!g || g.__KINEM_DEVTOOLS_HOOK__) return
  g.__KINEM_DEVTOOLS_HOOK__ = {
    version: 1,
    listActive,
    subscribe,
  }
}

/**
 * Enable tracking for every subsequent `play()` call. Idempotent. The
 * devtools package calls this at import time; other callers should only
 * do so if they need `listActive()` or `subscribe()` to report live
 * animation state.
 */
export function enableTracker(): void {
  enabled = true
  installHook()
}

/** True when tracking is active. Primarily for tests. */
export function isTrackerEnabled(): boolean {
  return enabled
}

/**
 * Register a `Controls` with the tracker. Returns the allocated id,
 * or `-1` if tracking is disabled (the common production case).
 * Called from `play()`; user code should not invoke this directly.
 */
export function trackAnimation(
  controls: Controls,
  targets: readonly StrategyTarget[],
  backend: StrategyBackend = "auto",
): number {
  if (!enabled) return -1
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

/**
 * Subscribe to tracker events. Returns an unsubscribe function.
 * Subscribing auto-enables the tracker: otherwise the subscriber would
 * silently receive no events.
 */
export function subscribe(fn: TrackerListener): () => void {
  enabled = true
  installHook()
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
  enabled = false
  const g =
    typeof globalThis !== "undefined"
      ? (globalThis as { __KINEM_DEVTOOLS_HOOK__?: KinemDevtoolsHook })
      : undefined
  // biome-ignore lint/performance/noDelete: exactOptionalPropertyTypes requires removal, not undefined assignment
  if (g) delete g.__KINEM_DEVTOOLS_HOOK__
}
