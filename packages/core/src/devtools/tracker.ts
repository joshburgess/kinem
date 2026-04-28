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

/**
 * Backends recognized by the tracker. The `play*` family uses the
 * strategy backends (auto / waapi / raf). Open-ended primitives
 * register under a label that names the primitive itself; their records
 * have `duration === 0` and a Controls façade whose only working method
 * is `cancel()`.
 */
export type TrackerBackend = StrategyBackend | "follow" | "scroll" | "scrub" | "ambient"

export interface AnimationRecord {
  readonly id: number
  /**
   * Total span in ms. `0` is a sentinel for ambient/open-ended records
   * (follow, scroll-sync, scrub) that have no fixed duration.
   */
  readonly duration: number
  readonly targets: readonly StrategyTarget[]
  readonly startedAt: number
  readonly state: StrategyState
  /** Rendering backend or ambient-primitive label. */
  readonly backend: TrackerBackend
  /**
   * Wall-clock elapsed ratio in [0, 1]. Not adjusted for pause or
   * seek, so treat this as a rough indicator rather than ground truth.
   * For exact timing, read from the strategy handle. For ambient
   * records this reads from the underlying handle when available and
   * otherwise stays at 0.
   */
  readonly progress: number
  /**
   * Live Controls handle. For ambient records this is a façade whose
   * `cancel()` delegates to the underlying primitive; pause / resume /
   * seek / reverse / restart are no-ops.
   */
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
  backend: TrackerBackend = "auto",
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

/**
 * Minimal contract a primitive needs to be registered as ambient. The
 * tracker only needs to be able to cancel the handle and observe its
 * state; everything else (pause / resume / seek) is a no-op for these
 * open-ended records.
 */
export interface AmbientHandle {
  cancel(): void
  readonly state: string
  /** Optional progress in [0, 1]. Defaults to 0 when not present. */
  readonly progress?: number
}

/**
 * Build a Controls-shaped façade for an ambient handle. Only `cancel`
 * has real behavior; pause / resume / seek / reverse / restart are
 * no-ops because open-ended primitives don't model those operations.
 * `finished` resolves once the handle is cancelled; this is what the
 * tracker watches to remove the record.
 */
function ambientControls(handle: AmbientHandle): Controls {
  let resolveFinished: () => void = () => {}
  let rejectFinished: (err: unknown) => void = () => {}
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve
    rejectFinished = reject
  })
  // The tracker awaits this promise to remove the record on cancel.
  // Mark it handled here; consumers reading `.finished` directly still
  // see the rejection.
  finished.catch(() => {})

  // biome-ignore lint/suspicious/noExplicitAny: minimal façade; Controls's full surface isn't meaningful here
  const noop = function (this: any) {
    // biome-ignore lint/suspicious/noThisInStatic: this is bound to the controls façade
    return controls
  }
  const controls: Controls = {
    pause: noop as Controls["pause"],
    resume: noop as Controls["resume"],
    seek: noop as Controls["seek"],
    seekLabel: noop as Controls["seekLabel"],
    reverse: noop as Controls["reverse"],
    restart: noop as Controls["restart"],
    cancel(): Controls {
      handle.cancel()
      rejectFinished(new Error("kinem: ambient handle cancelled"))
      return controls
    },
    duration: 0,
    get state(): StrategyState {
      // Map the primitive's "active"/"cancelled" state into the strategy
      // vocabulary so consumers don't need to special-case ambient.
      return handle.state === "cancelled" ? "cancelled" : "playing"
    },
    get progress(): number {
      const p = handle.progress
      return typeof p === "number" ? p : 0
    },
    get direction(): 1 | -1 {
      return 1
    },
    get finished(): Promise<void> {
      return finished
    },
    get labels(): ReadonlyMap<string, number> {
      return EMPTY_LABELS
    },
    get speed(): number {
      return 1
    },
    set speed(_v: number) {
      // ambient handles don't support speed control
    },
    then<T1 = void, T2 = never>(
      onfulfilled?: ((v: void) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((err: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
      return finished.then(onfulfilled, onrejected)
    },
    catch<R>(onrejected: (err: unknown) => R | PromiseLike<R>): Promise<void | R> {
      return finished.catch(onrejected)
    },
    finally(onfinally?: (() => void) | null): Promise<void> {
      return finished.finally(onfinally)
    },
  }
  // We never call `resolveFinished`: ambient records only end via
  // cancel. Reference it to satisfy the no-unused warning.
  void resolveFinished
  return controls
}

const EMPTY_LABELS: ReadonlyMap<string, number> = new Map()

/**
 * Register an open-ended primitive (follow, scroll-sync, scrub, …) with
 * the tracker so devtools can see it. Returns the allocated id, or
 * `-1` if tracking is disabled.
 *
 * Records produced by `trackAmbient` carry `duration === 0` to signal
 * "no fixed span", and a Controls façade whose only meaningful method
 * is `cancel()`. Pause / resume / seek are no-ops because the source
 * primitives don't model them.
 *
 * Called from inside the primitives themselves; user code should not
 * invoke directly.
 */
export function trackAmbient(
  handle: AmbientHandle,
  backend: TrackerBackend,
  targets: readonly StrategyTarget[] = [],
): number {
  if (!enabled) return -1
  const controls = ambientControls(handle)
  const id = nextId++
  const startedAt = now()
  const record: AnimationRecord = {
    id,
    duration: 0,
    targets,
    startedAt,
    backend,
    controls,
    get state(): StrategyState {
      return controls.state
    },
    get progress(): number {
      return controls.progress
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

/**
 * Remove an ambient record by id and emit a `cancel` event. Called from
 * the primitives' own `cancel()` paths so that records get cleaned up
 * even when callers cancel the underlying handle directly (rather than
 * routing through the tracker's controls façade). No-op if the id is
 * unknown (already removed, or tracking was disabled when the record
 * was registered).
 */
export function untrackAmbient(id: number): void {
  if (id < 0) return
  if (!active.delete(id)) return
  emit({ type: "cancel", id })
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
