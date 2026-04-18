/**
 * Render strategy router. Inspects the properties an `AnimationDef`
 * produces, partitions them into compositor-safe vs main-thread sets,
 * and dispatches each half to the best available backend.
 *
 *   - compositor-safe → WAAPI when supported, else rAF
 *   - main-thread     → rAF
 *
 * Both halves share a view of the same source animation via `map()`,
 * so they stay in lock-step without an external coordinator.
 *
 * Consumers that want to force a specific backend can pass
 * `{ backend: "raf" | "waapi" }`; `"auto"` (the default) picks per
 * property group based on capability detection.
 */

import { type LazyPromise, createLazyPromise } from "../core/lazy-promise"
import type { AnimationDef } from "../core/types"
import { type FrameScheduler, frame as defaultFrame } from "../scheduler/frame"
import type { ElementShim, PropertyValue } from "./apply"
import { partitionByTier } from "./properties"
import { type RafOpts, playRaf } from "./raf"
import { type Animatable, type WaapiOpts, playWaapi } from "./waapi"

export type StrategyBackend = "auto" | "waapi" | "raf"

export type StrategyState = "idle" | "playing" | "paused" | "finished" | "cancelled"

export interface StrategyTarget extends ElementShim, Animatable {}

export interface StrategyHandle {
  pause(): void
  resume(): void
  seek(progress: number): void
  reverse(): void
  setSpeed(multiplier: number): void
  cancel(): void
  readonly state: StrategyState
  readonly finished: Promise<void>
}

export interface StrategyOpts extends WaapiOpts, RafOpts {
  readonly backend?: StrategyBackend
  /**
   * Override capability detection. Use for testing, or to force WAAPI
   * on platforms where the probe would fail but you know it works.
   */
  readonly waapiSupported?: boolean
  /**
   * Defer the `Element.animate()` call for WAAPI-bound animations to
   * the next scheduler tick. Cancelling the returned handle before the
   * tick fires skips the WAAPI setup entirely. Default `true`.
   *
   * Useful for hover-flicker and rapid-toggle patterns where an
   * animation may be cancelled before it ever reaches the compositor.
   * Tests that assert synchronous WAAPI behavior should set `false`.
   */
  readonly lazy?: boolean
}

export type AnimationProps = Readonly<Record<string, PropertyValue>>

let waapiCache: boolean | null = null

/**
 * Probe for WAAPI support by testing the prototype. The result is
 * cached at module scope; capability doesn't change over a page's
 * lifetime, and every `play()` that didn't pass `waapiSupported`
 * would otherwise re-run the prototype lookup.
 */
export function detectWaapi(): boolean {
  if (waapiCache !== null) return waapiCache
  if (typeof Element === "undefined") {
    waapiCache = false
    return false
  }
  const proto = (Element as unknown as { prototype?: { animate?: unknown } }).prototype
  waapiCache = typeof proto?.animate === "function"
  return waapiCache
}

/**
 * Discover which property names the animation produces. Leaf
 * constructors (`tween`, `keyframes`) populate a `properties` cache we
 * use directly; otherwise we fall back to sampling at t=0 and t=1, which
 * assumes the property set is constant over time.
 */
export function discoverProperties(def: AnimationDef<AnimationProps>): readonly string[] {
  if (def.properties !== undefined) return def.properties
  const set = new Set<string>()
  const a = def.interpolate(0)
  const b = def.interpolate(1)
  for (const k in a) set.add(k)
  for (const k in b) set.add(k)
  return [...set]
}

function project(
  def: AnimationDef<AnimationProps>,
  keys: readonly string[],
): AnimationDef<AnimationProps> {
  const keySet = new Set(keys)
  // Built inline rather than via `map()` so we can propagate the
  // `linearizable` marker and `properties` cache. A tier-filtered view
  // of a linearizable tween remains linearizable: we only drop keys,
  // never change how the remaining ones interpolate.
  const projected: AnimationDef<AnimationProps> = {
    duration: def.duration,
    easing: def.easing,
    interpolate: (p) => {
      const v = def.interpolate(p)
      const out: Record<string, PropertyValue> = {}
      for (const k of keySet) {
        const value = v[k]
        if (value !== undefined) out[k] = value
      }
      return out
    },
    properties: keys,
  }
  return def.linearizable ? { ...projected, linearizable: true } : projected
}

/**
 * Combine two handles into one. State transitions collapse as follows:
 *   - cancelled if either is cancelled
 *   - finished when both are finished
 *   - otherwise tracks the last user action
 *
 * Exported for internal use by the timeline module; public consumers
 * should not combine handles directly.
 */
export function combineHandles(
  handles: readonly StrategyHandle[],
  willChangeCleanup: (() => void) | null = null,
): StrategyHandle {
  // Fast path: a single handle is the common case when all properties
  // fall into one tier, or when the caller forced a specific backend.
  // Skip the settled/pending state machine and return the handle
  // directly (or a thin wrapper that chains cleanup onto `finished`).
  if (handles.length === 1) {
    const only = handles[0] as StrategyHandle
    if (willChangeCleanup === null) return only
    const lp = createLazyPromise()
    only.finished.then(
      () => {
        willChangeCleanup()
        lp.resolve()
      },
      (err) => {
        willChangeCleanup()
        lp.reject(err)
      },
    )
    return {
      pause: () => only.pause(),
      resume: () => only.resume(),
      seek: (p) => only.seek(p),
      reverse: () => only.reverse(),
      setSpeed: (m) => only.setSpeed(m),
      cancel: () => only.cancel(),
      get state() {
        return only.state
      },
      get finished() {
        return lp.promise
      },
    }
  }

  let userState: StrategyState = "playing"
  let settled = false
  let cleanupRan = false
  const lp = createLazyPromise()

  const runCleanup = (): void => {
    if (cleanupRan) return
    cleanupRan = true
    willChangeCleanup?.()
  }

  const settleFinish = (): void => {
    if (settled) return
    settled = true
    userState = "finished"
    runCleanup()
    lp.resolve()
  }

  const settleCancel = (err: unknown): void => {
    if (settled) return
    settled = true
    userState = "cancelled"
    runCleanup()
    lp.reject(err)
  }

  let pending = handles.length
  for (const h of handles) {
    h.finished.then(
      () => {
        pending--
        if (pending === 0 && userState !== "cancelled") settleFinish()
      },
      (err) => {
        settleCancel(err)
      },
    )
  }

  if (handles.length === 0) settleFinish()

  return {
    pause() {
      if (userState !== "playing") return
      userState = "paused"
      for (const h of handles) h.pause()
    },
    resume() {
      if (userState !== "paused") return
      userState = "playing"
      for (const h of handles) h.resume()
    },
    seek(p: number) {
      for (const h of handles) h.seek(p)
    },
    reverse() {
      for (const h of handles) h.reverse()
    },
    setSpeed(multiplier: number) {
      for (const h of handles) h.setSpeed(multiplier)
    },
    cancel() {
      if (userState === "finished" || userState === "cancelled") return
      userState = "cancelled"
      for (const h of handles) h.cancel()
      // Child rejections flow into settleCancel(), which runs cleanup
      // and rejects the lazy promise once. If every child happens to
      // be already settled (no handle rejects), we still need to run
      // cleanup and reject here.
      if (!settled) {
        settled = true
        runCleanup()
        lp.rejectCancelled()
      }
    },
    get state() {
      return userState
    },
    get finished() {
      return lp.promise
    },
  }
}

function applyWillChange(targets: readonly StrategyTarget[], props: readonly string[]): () => void {
  if (props.length === 0) return () => {}
  const value = props.join(", ")
  for (const t of targets) t.style.setProperty("will-change", value)
  return () => {
    for (const t of targets) t.style.setProperty("will-change", "auto")
  }
}

/**
 * Wrap a handle factory so that the real handle is built on the next
 * scheduler tick instead of synchronously. Control-plane calls made
 * before the tick are queued and replayed once the inner handle exists;
 * `cancel()` before the tick short-circuits the factory entirely.
 *
 * `onSettle`, if provided, runs when the inner handle finishes or is
 * cancelled after the factory has fired. For the cancel-before-first
 * path, `onSettle` does NOT run: the factory never executed, so there's
 * nothing (e.g. will-change) to undo. Callers can use this to skip the
 * outer combineHandles wrapper that was previously needed to chain
 * cleanup onto the handle's `finished` promise. At n=1000 that's an
 * entire layer of closure + lazy-promise allocation removed per play.
 *
 * Implemented as a class so the eight public methods/getters live on
 * the prototype once rather than being reallocated as fresh closures
 * per play. The factory tick and inner-settlement handlers use
 * `.bind(this)` to route through private methods, which V8 reliably
 * optimizes into direct calls once the class shape is stable.
 */
// Shared ops for queued pause/resume (no captured args, so they can be
// module-level constants instead of per-call arrow allocations).
const queuedPause = (h: StrategyHandle): void => h.pause()
const queuedResume = (h: StrategyHandle): void => h.resume()
const queuedReverse = (h: StrategyHandle): void => h.reverse()

class LazyHandleImpl implements StrategyHandle {
  readonly #factory: () => StrategyHandle
  readonly #onSettle: (() => void) | null
  readonly #lp: LazyPromise
  #inner: StrategyHandle | null = null
  #pendingState: StrategyState = "playing"
  // Lazy-alloc: most plays queue nothing before the factory tick fires.
  #pending: Array<(h: StrategyHandle) => void> | null = null

  constructor(
    factory: () => StrategyHandle,
    scheduler: FrameScheduler,
    onSettle: (() => void) | null,
  ) {
    this.#factory = factory
    this.#onSettle = onSettle
    this.#lp = createLazyPromise()
    // One-shot schedule: cheaper than keepalive (plain array push vs
    // linked-list + Map insert). `cancel()` before the tick fires can't
    // extract the entry from the queue; instead it sets `#pendingState`
    // and `#runFactory` short-circuits on drain. Tried routing this
    // through a keepalive registration (so `cancel()` could call
    // `scheduler.cancel()` for immediate removal) and measured a ~3x
    // regression on cancel-before-first at n=1000 in exchange for
    // preventing queue bloat in backgrounded tabs (a non-goal for
    // foreground perf). Stay on the one-shot path.
    scheduler.schedule("update", this.#runFactory.bind(this))
  }

  #runFactory(): void {
    if (this.#pendingState === "cancelled") return
    const inner = this.#factory()
    this.#inner = inner
    inner.finished.then(this.#onInnerResolve.bind(this), this.#onInnerReject.bind(this))
    const pending = this.#pending
    if (pending !== null) {
      for (const op of pending) op(inner)
      this.#pending = null
    }
  }

  #onInnerResolve(): void {
    this.#onSettle?.()
    this.#lp.resolve()
  }

  #onInnerReject(err: unknown): void {
    this.#onSettle?.()
    this.#lp.reject(err)
  }

  #queue(op: (h: StrategyHandle) => void): void {
    if (this.#pending === null) this.#pending = [op]
    else this.#pending.push(op)
  }

  pause(): void {
    const inner = this.#inner
    if (inner !== null) {
      inner.pause()
      return
    }
    if (this.#pendingState === "playing") {
      this.#pendingState = "paused"
      this.#queue(queuedPause)
    }
  }

  resume(): void {
    const inner = this.#inner
    if (inner !== null) {
      inner.resume()
      return
    }
    if (this.#pendingState === "paused") {
      this.#pendingState = "playing"
      this.#queue(queuedResume)
    }
  }

  seek(p: number): void {
    const inner = this.#inner
    if (inner !== null) inner.seek(p)
    else this.#queue((h) => h.seek(p))
  }

  reverse(): void {
    const inner = this.#inner
    if (inner !== null) inner.reverse()
    else this.#queue(queuedReverse)
  }

  setSpeed(m: number): void {
    const inner = this.#inner
    if (inner !== null) inner.setSpeed(m)
    else this.#queue((h) => h.setSpeed(m))
  }

  cancel(): void {
    const inner = this.#inner
    if (inner !== null) {
      inner.cancel()
      return
    }
    if (this.#pendingState === "cancelled" || this.#pendingState === "finished") return
    this.#pendingState = "cancelled"
    this.#lp.rejectCancelled()
  }

  get state(): StrategyState {
    return this.#inner?.state ?? this.#pendingState
  }

  get finished(): Promise<void> {
    return this.#lp.promise
  }
}

function lazyHandle(
  factory: () => StrategyHandle,
  scheduler: FrameScheduler,
  onSettle: (() => void) | null = null,
): StrategyHandle {
  return new LazyHandleImpl(factory, scheduler, onSettle)
}

/**
 * Play an animation against pre-resolved targets, auto-picking the best
 * backend(s). Compositor-safe properties route to WAAPI (when supported),
 * and the rest route to the rAF backend. Both are synchronized by virtue
 * of sampling the same `AnimationDef`.
 *
 * Users should prefer the public `play()` in `api/play`, which also
 * handles target resolution and returns a richer `Controls` object.
 */
// Tier partition for a def. Leaf constructors (`tween`, `keyframes`)
// populate `def.tierSplit` at construction time so first-play unique-
// def workloads skip this work. For non-leaf defs (combinators,
// user-built animations), fall back to a WeakMap cache so shared-def
// replay (one def, N targets) also avoids re-running
// `discoverProperties + partitionByTier`. Parallels the planWaapi cache.
interface TierSplit {
  readonly props: readonly string[]
  readonly compositor: readonly string[]
  readonly main: readonly string[]
}
const tierCache = new WeakMap<AnimationDef<AnimationProps>, TierSplit>()

function splitDef(def: AnimationDef<AnimationProps>): TierSplit {
  // Leaf fast path: `tierSplit` was built at construction with `props`
  // included, so we can return it directly. No per-play object alloc,
  // no WeakMap round-trip, no classification work.
  if (def.tierSplit !== undefined) return def.tierSplit
  const cached = tierCache.get(def)
  if (cached !== undefined) return cached
  const props = discoverProperties(def)
  const split = partitionByTier(props)
  tierCache.set(def, split)
  return split
}

export function playStrategy(
  def: AnimationDef<AnimationProps>,
  targets: readonly StrategyTarget[],
  opts: StrategyOpts = {},
  // Optional explicit backend. Lets callers (notably `play()`, which has
  // `mode` → backend mapping) bypass `resolveStrategyOpts`'s spread of
  // `opts` to inject a backend. When undefined we fall back to
  // `opts.backend ?? "auto"`.
  backendOverride?: StrategyBackend,
): StrategyHandle {
  const backend: StrategyBackend = backendOverride ?? opts.backend ?? "auto"

  // Backend-independent fast path for the rAF-only case: skip the
  // compositor-tier machinery entirely (splitDef, WAAPI closures, the
  // handles array, combineHandles). This is what the default
  // `mode: "main"` path hits for every play, so every alloc we save
  // here shows up in cancel-before-first and startup-commit.
  if (backend === "raf") {
    return playRaf(def, targets, opts)
  }

  const waapiCap = opts.waapiSupported ?? detectWaapi()
  // `backend === "waapi"` forces WAAPI regardless of capability; `auto`
  // needs the capability probe. `backend === "raf"` was handled above.
  const useWaapi = backend === "waapi" || waapiCap

  // If `auto` is asked but WAAPI isn't available, the whole animation
  // must run on rAF. Fast path out like the explicit "raf" case.
  if (!useWaapi) return playRaf(def, targets, opts)

  const { compositor, main } = splitDef(def)
  // `mainProps` is the set of properties we route to rAF. For `auto` we
  // take whatever `splitDef` classified as main-tier; for `backend ===
  // "waapi"` we force everything onto WAAPI, so mainProps is empty.
  const mainProps = backend === "auto" ? main : EMPTY_PROPS
  const needsMain = mainProps.length > 0
  const hasCompProps = compositor.length > 0

  // `auto` where every property is main-tier: no compositor handle to
  // build, no will-change to manage. Straight to rAF. (`backend ===
  // "waapi"` can't land here because mainProps is empty.)
  if (!hasCompProps && backend === "auto") return playRaf(def, targets, opts)

  // Past this point there is a compositor-bound handle to build. Set up
  // the lazy-handle scaffolding + will-change lifecycle once. The
  // closures here are only allocated on the WAAPI-bearing path; the
  // rAF-only paths exited above without paying for them.
  const lazy = opts.lazy ?? true
  const scheduler = opts.scheduler ?? defaultFrame
  // `backend === "waapi"` with all-main props is a user-forced override;
  // don't apply will-change in that case (no compositor props to hint on).
  const willChangeProps = hasCompProps ? compositor : null

  let cleanupWillChange: (() => void) | null = null
  const ensureWillChange = (): void => {
    if (willChangeProps !== null && cleanupWillChange === null) {
      cleanupWillChange = applyWillChange(targets, willChangeProps)
    }
  }

  // For the lazy path, cleanup (will-change undo) is integrated into
  // `lazyHandle` itself. This lets us skip the combineHandles single-
  // handle wrapper that used to exist solely to chain cleanup onto the
  // handle's `finished`. For the eager path, cleanup still flows
  // through combineHandles (see `cleanupThunk` below).
  const onWaapiSettle = willChangeProps !== null ? () => cleanupWillChange?.() : null
  const wrapWaapi = (build: () => StrategyHandle): StrategyHandle => {
    if (!lazy) {
      ensureWillChange()
      return build()
    }
    return lazyHandle(
      () => {
        ensureWillChange()
        return build()
      },
      scheduler,
      onWaapiSettle,
    )
  }

  // Note on why there's no `wrapRaf` equivalent: rAF's setup is cheap
  // (one `createTiming` + two scheduler registrations). Wrapping it in
  // `lazyHandle` to make cancel-before-first allocation-free turns out
  // to be a net regression for the common path: the extra lazyHandle
  // closures + its own scheduler.schedule cost more per play than
  // createTiming does, so startup at n=1000 regressed by ~4 ms in
  // exchange for ~1 ms off cancel-before-first. WAAPI lazy-wrapping
  // works because Element.animate is genuinely expensive; rAF setup
  // isn't, so we pay the setup eagerly and accept the slightly higher
  // cancel-before-first cost.

  // Pure WAAPI fast path: only a compositor-tier handle, no projection,
  // no combineHandles wrapper. Covers `backend === "waapi"` and the
  // common `auto` case where every animated property is compositor-safe
  // (e.g. opacity/transform-only tweens).
  if (!needsMain) {
    return wrapWaapi(() => playWaapi(def, targets, opts))
  }

  // Mixed auto path: both tiers have props. `project()` allocates an
  // AnimationDef + closure per call and the backends re-invoke that
  // closure every tick, so only run it when the filter isn't the
  // identity (here it always is, since both tiers are non-empty).
  const handles: StrategyHandle[] = [
    wrapWaapi(() => playWaapi(project(def, compositor), targets, opts)),
    playRaf(project(def, mainProps), targets, opts),
  ]

  // combineHandles needs a stable cleanup thunk; route through a closure
  // so it sees whichever value ensureWillChange() set (if any). In the
  // lazy path, cleanup is already integrated into the WAAPI `lazyHandle`,
  // so combineHandles sees a null cleanup and can take the single-handle
  // fast path (which returns the handle directly with no wrapper).
  const cleanupThunk = !lazy && willChangeProps !== null ? () => cleanupWillChange?.() : null
  return combineHandles(handles, cleanupThunk)
}

const EMPTY_PROPS: readonly string[] = Object.freeze([])
