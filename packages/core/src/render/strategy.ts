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

import type { AnimationDef } from "../core/types"
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
}

export type AnimationProps = Readonly<Record<string, PropertyValue>>

/** Probe for WAAPI support by testing the prototype. */
export function detectWaapi(): boolean {
  if (typeof Element === "undefined") return false
  const proto = (Element as unknown as { prototype?: { animate?: unknown } }).prototype
  return typeof proto?.animate === "function"
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
    const finished = only.finished.then(
      () => {
        willChangeCleanup()
      },
      (err) => {
        willChangeCleanup()
        throw err
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
        return finished
      },
    }
  }

  let userState: StrategyState = "playing"
  let settled = false
  let cleanupRan = false
  let resolveFinished!: () => void
  let rejectFinished!: (err: unknown) => void
  const finished = new Promise<void>((res, rej) => {
    resolveFinished = res
    rejectFinished = rej
  })

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
    resolveFinished()
  }

  const settleCancel = (err: unknown): void => {
    if (settled) return
    settled = true
    userState = "cancelled"
    runCleanup()
    rejectFinished(err)
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
      // Child rejections flow into settleCancel(), which fires
      // willChangeCleanup and rejectFinished exactly once. If every
      // child happens to be already settled (no handle rejects), we
      // still need to run cleanup here.
      if (!settled) {
        settled = true
        runCleanup()
        rejectFinished(new Error("animation cancelled"))
      }
    },
    get state() {
      return userState
    },
    get finished() {
      return finished
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
 * Play an animation against pre-resolved targets, auto-picking the best
 * backend(s). Compositor-safe properties route to WAAPI (when supported),
 * and the rest route to the rAF backend. Both are synchronized by virtue
 * of sampling the same `AnimationDef`.
 *
 * Users should prefer the public `play()` in `api/play`, which also
 * handles target resolution and returns a richer `Controls` object.
 */
export function playStrategy(
  def: AnimationDef<AnimationProps>,
  targets: readonly StrategyTarget[],
  opts: StrategyOpts = {},
): StrategyHandle {
  const props = discoverProperties(def)
  const { compositor, main } = partitionByTier(props)

  const backend: StrategyBackend = opts.backend ?? "auto"
  const waapiCap = opts.waapiSupported ?? detectWaapi()
  const useWaapi = backend === "waapi" || (backend === "auto" && waapiCap)

  const cleanupWillChange =
    useWaapi && compositor.length > 0 ? applyWillChange(targets, compositor) : null

  const handles: StrategyHandle[] = []

  if (backend === "waapi") {
    handles.push(playWaapi(def, targets, opts))
  } else if (backend === "raf") {
    handles.push(playRaf(def, targets, opts))
  } else {
    // auto: split by tier. When all properties live in one tier, skip
    // the projection wrapper: project() allocates an AnimationDef +
    // closure per call and the backends re-invoke that closure every
    // tick for no gain when the filter is the identity.
    const mainProps = useWaapi ? main : props
    const splitNeeded = useWaapi && compositor.length > 0 && mainProps.length > 0

    if (compositor.length > 0 && useWaapi) {
      const compDef = splitNeeded ? project(def, compositor) : def
      handles.push(playWaapi(compDef, targets, opts))
    }
    if (mainProps.length > 0) {
      const mainDef = splitNeeded ? project(def, mainProps) : def
      handles.push(playRaf(mainDef, targets, opts))
    }
  }

  return combineHandles(handles, cleanupWillChange)
}
