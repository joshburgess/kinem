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

import { createLazyPromise } from "../core/lazy-promise"
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
 *   - `cancelled` if any child is cancelled (sticky once set)
 *   - otherwise derived on-demand from children: `playing` if any child is
 *     playing, `paused` if any child is paused, `finished` if all finished
 *
 * Deriving state from children (rather than tracking it independently) is
 * what makes re-arm cycles honest. After every child finishes naturally,
 * the combined state reports `finished`; if the user then calls `seek(0)`
 * or `reverse()` and children transition back to `playing`, the combined
 * state reports `playing` again. Without this, the combined wrapper would
 * return a stale `finished` while children visibly animate again.
 *
 * The combined `finished` promise is still single-shot: it resolves on
 * the first natural completion and cannot be re-armed. Users who replay
 * via `seek`/`reverse` should observe subsequent cycles via `state`, not
 * by awaiting `finished` a second time.
 *
 * Exported for internal use by the timeline module; public consumers
 * should not combine handles directly.
 */
export function combineHandles(handles: readonly StrategyHandle[]): StrategyHandle {
  // Fast path: a single handle is the common case when all properties
  // fall into one tier, or when the caller forced a specific backend.
  // Skip the settled/pending state machine and return the handle
  // directly.
  if (handles.length === 1) return handles[0] as StrategyHandle

  let userState: StrategyState = "playing"
  let settled = false
  const lp = createLazyPromise()

  const settleFinish = (): void => {
    if (settled) return
    settled = true
    userState = "finished"
    lp.resolve()
  }

  const settleCancel = (err: unknown): void => {
    if (settled) return
    settled = true
    userState = "cancelled"
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
      if (userState === "cancelled") return
      for (const h of handles) h.seek(p)
    },
    reverse() {
      if (userState === "cancelled") return
      for (const h of handles) h.reverse()
    },
    setSpeed(multiplier: number) {
      if (userState === "cancelled") return
      for (const h of handles) h.setSpeed(multiplier)
    },
    cancel() {
      if (userState === "finished" || userState === "cancelled") return
      userState = "cancelled"
      for (const h of handles) h.cancel()
      // Child rejections flow into settleCancel(), which rejects the
      // lazy promise once. If every child happens to be already settled
      // (no handle rejects), we still need to reject here.
      if (!settled) {
        settled = true
        lp.rejectCancelled()
      }
    },
    get state() {
      // `cancelled` is sticky: once any child rejects, the combined handle
      // is cancelled regardless of what the others report.
      if (userState === "cancelled") return "cancelled"
      // Derive from children so re-arm cycles (scroll-triggered `reverse` /
      // `seek(0)` from a finished state) report accurately. Without this
      // the getter stays "finished" while children are playing again,
      // producing a visible zombie: animation runs, state says finished.
      //
      // The combined `finished` promise remains single-shot (see the JSDoc
      // on `Controls`): it resolves on first completion and cannot be
      // re-armed because we only subscribe to each child's finished once.
      let anyPlaying = false
      let anyPaused = false
      let allFinished = true
      for (const h of handles) {
        const s = h.state
        if (s !== "finished") allFinished = false
        if (s === "playing") anyPlaying = true
        else if (s === "paused") anyPaused = true
      }
      if (anyPlaying) return "playing"
      if (anyPaused) return "paused"
      if (allFinished) return "finished"
      return userState
    },
    get finished() {
      return lp.promise
    },
  }
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

  // Past this point there is a compositor-bound handle to build.
  //
  // We used to set `will-change` on the targets here and clear it on
  // settle. For WAAPI-bound animations on compositor-safe properties
  // (opacity, transform, filter) this is redundant: Chrome, Firefox,
  // and modern Safari all auto-promote elements with active WAAPI
  // transform/opacity animations, independent of will-change. And our
  // own timing made it useless even as a hint: the write fired in the
  // same rAF tick as `Element.animate()`, so the compositor saw both
  // in the same paint cycle and had no chance to prepare a layer in
  // advance. Removing it saves 2×N `setProperty` calls per play.
  //
  // Lazy WAAPI setup (deferring `Element.animate()` calls to the next
  // scheduler tick) now lives inside `WaapiImpl` itself. Passing the
  // scheduler opts it in; passing `null` runs synchronously. This
  // replaced a `LazyHandleImpl` wrapper class that only ever wrapped
  // `playWaapi`, so collapsing the two handles into one saves a
  // LazyPromise + factory closure + inner-settle subscription per
  // play. Cancel-before-first still short-circuits the same way: the
  // deferred `Element.animate()` calls never run.
  const waapiScheduler: FrameScheduler | null =
    (opts.lazy ?? true) ? (opts.scheduler ?? defaultFrame) : null

  // Note on why there's no rAF-lazy equivalent: rAF setup is cheap
  // (one `createTiming` + two scheduler registrations). Deferring it
  // to save cancel-before-first work regressed the common path by
  // ~4 ms at n=1000 in earlier experiments. WAAPI lazy setup pays off
  // because `Element.animate()` is genuinely expensive; rAF isn't.

  // Pure WAAPI fast path: only a compositor-tier handle, no projection,
  // no combineHandles wrapper. Covers `backend === "waapi"` and the
  // common `auto` case where every animated property is compositor-safe
  // (e.g. opacity/transform-only tweens).
  if (!needsMain) {
    return playWaapi(def, targets, opts, waapiScheduler)
  }

  // Mixed auto path: both tiers have props. `project()` allocates an
  // AnimationDef + closure per call and the backends re-invoke that
  // closure every tick, so only run it when the filter isn't the
  // identity (here it always is, since both tiers are non-empty).
  const handles: StrategyHandle[] = [
    playWaapi(project(def, compositor), targets, opts, waapiScheduler),
    playRaf(project(def, mainProps), targets, opts),
  ]

  return combineHandles(handles)
}

const EMPTY_PROPS: readonly string[] = Object.freeze([])
