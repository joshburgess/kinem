/**
 * `motion` is a Svelte action that runs a tween from `initial` to
 * `animate` when mounted and replaces in-flight animations when the
 * `animate` target changes.
 *
 *   <div use:motion={{ initial: { opacity: 0 }, animate: { opacity: 1 },
 *                      transition: { duration: 300 } }} />
 *
 * Variants. Pass a `variants` map of named `MotionValues` and use a
 * string key for `initial`, `animate`, `whileHover`, or `whileTap`:
 *
 *   const v = { closed: { opacity: 0 }, open: { opacity: 1 } }
 *   <div use:motion={{ variants: v, initial: "closed",
 *                      animate: isOpen ? "open" : "closed" }} />
 *
 * whileHover / whileTap. Resolved values from these props temporarily
 * override `animate` while the pointer is over (hover) or pressed
 * (tap). Tap takes precedence over hover. The action attaches its own
 * pointer listeners and removes them on `destroy()`. For orchestrated
 * exit animations use the separate `kinemTransition` (Svelte
 * `transition:` directive) instead.
 *
 * The `initial` values are written synchronously to the element's
 * inline style so the first paint lands at the starting frame. On
 * update, the action diffs the resolved target and starts a new tween
 * whenever it changes. Svelte's reactivity is not used to drive
 * per-frame state: mutation happens directly on the DOM node.
 */

import type { Controls, EasingFn, NormalizedVelocity, PlayOpts, StrategyTarget } from "@kinem/core"
import { omitUndefined, play, resolveTransition, tween } from "@kinem/core"

export type MotionValues = Readonly<Record<string, string | number>>

export type Variants = Readonly<Record<string, MotionValues>>

/**
 * What `initial`, `animate`, `whileHover`, and `whileTap` accept:
 * inline values, a single variant key, or an array of keys merged in
 * order (later wins). String / array forms require a `variants` map;
 * otherwise they resolve to `undefined` and the prop is ignored.
 */
export type VariantTarget = MotionValues | string | readonly string[]

export interface MotionTransition {
  /**
   * "tween" (default) plays a fixed-duration easing; "spring" plays a
   * physical spring. When omitted, the presence of any spring field
   * implies "spring".
   */
  readonly type?: "tween" | "spring"
  readonly duration?: number
  readonly easing?: EasingFn
  readonly stiffness?: number
  readonly damping?: number
  readonly mass?: number
  /**
   * Spring: initial velocity, in normalized [0, 1]/sec units of travel.
   * Mint with `normalizedVelocity()` or `velocityFromSpan()`.
   */
  readonly velocity?: NormalizedVelocity
  readonly backend?: PlayOpts["backend"]
  /** Delay in ms before the tween starts. */
  readonly delay?: number
}

/**
 * A Svelte-readable store of `VariantTarget | undefined`. Created by
 * `motionGroup()` and shared with descendant `use:motion` actions via
 * the `group` option (typically passed through `setContext` /
 * `getContext` in the parent component's script). When a descendant has
 * no explicit `animate`, its target follows the group store.
 */
export interface MotionGroupStore {
  subscribe(run: (value: VariantTarget | undefined) => void): () => void
  set(value: VariantTarget | undefined): void
  update(fn: (prev: VariantTarget | undefined) => VariantTarget | undefined): void
  get(): VariantTarget | undefined
}

export interface MotionActionOpts {
  readonly variants?: Variants
  readonly initial?: VariantTarget
  readonly animate?: VariantTarget
  readonly whileHover?: VariantTarget
  readonly whileTap?: VariantTarget
  readonly transition?: MotionTransition
  /**
   * Optional group store that drives the implicit animate target when
   * `animate` is undefined. The action subscribes on mount, applies
   * each emission as the new target, and unsubscribes on destroy.
   * Pair with `motionGroup()` (and Svelte's `setContext` /
   * `getContext`) to cascade a single state flip across a subtree.
   */
  readonly group?: MotionGroupStore
}

/**
 * Build a writable group store. The returned store satisfies the Svelte
 * readable contract (`subscribe`) plus an imperative `set` / `update` /
 * `get` for parent code that drives the value programmatically.
 *
 *   // parent script
 *   import { motionGroup } from "@kinem/svelte"
 *   import { setContext } from "svelte"
 *   const animate = motionGroup<"open" | "closed">("closed")
 *   setContext("kinem.motion.group", animate)
 *
 *   // child script
 *   import { getContext } from "svelte"
 *   const animate = getContext("kinem.motion.group")
 *   <div use:motion={{ variants: v, initial: "closed", group: animate }} />
 */
export function motionGroup<T extends VariantTarget | undefined = VariantTarget | undefined>(
  initial: T,
): MotionGroupStore {
  let value: VariantTarget | undefined = initial
  const subs = new Set<(v: VariantTarget | undefined) => void>()
  const set = (next: VariantTarget | undefined): void => {
    if (value === next) return
    value = next
    for (const fn of Array.from(subs)) fn(next)
  }
  return {
    subscribe(run) {
      run(value)
      subs.add(run)
      return () => {
        subs.delete(run)
      }
    },
    set,
    update(fn) {
      set(fn(value))
    },
    get() {
      return value
    },
  }
}

function applyInline(el: Element, values: MotionValues): void {
  const style = (el as HTMLElement).style
  if (!style) return
  for (const key of Object.keys(values)) {
    const v = values[key]
    if (v === undefined) continue
    style.setProperty(key, typeof v === "number" ? String(v) : v)
  }
}

function resolveTarget(
  target: VariantTarget | undefined,
  variants: Variants | undefined,
): MotionValues | undefined {
  if (target === undefined) return undefined
  if (typeof target === "string") return variants?.[target]
  if (Array.isArray(target)) {
    if (!variants) return undefined
    const merged: Record<string, string | number> = {}
    for (const k of target) {
      const v = variants[k]
      if (v) Object.assign(merged, v)
    }
    return merged
  }
  return target as MotionValues
}

function shallowEqualValues(a: MotionValues | undefined, b: MotionValues | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

function buildTweenProps(
  from: MotionValues,
  to: MotionValues,
): Record<string, readonly [string | number, string | number]> {
  const props: Record<string, readonly [string | number, string | number]> = {}
  for (const key of Object.keys(to)) {
    const fromVal = from[key] ?? to[key]
    const toVal = to[key]
    if (fromVal === undefined || toVal === undefined) continue
    props[key] = [fromVal, toVal]
  }
  return props
}

export interface MotionActionReturn {
  update(opts: MotionActionOpts): void
  destroy(): void
}

export function motion(node: Element, opts: MotionActionOpts = {}): MotionActionReturn {
  let currentOpts = opts
  let controls: Controls | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null
  let hovering = false
  let tapping = false
  let groupValue: VariantTarget | undefined
  let currentGroup: MotionGroupStore | undefined
  let unsubscribeGroup: (() => void) | null = null
  let mounted = false

  const resolveAll = (
    o: MotionActionOpts,
  ): {
    initial: MotionValues | undefined
    animate: MotionValues | undefined
    hover: MotionValues | undefined
    tap: MotionValues | undefined
  } => ({
    initial: resolveTarget(o.initial, o.variants),
    animate: resolveTarget(o.animate ?? groupValue, o.variants),
    hover: resolveTarget(o.whileHover, o.variants),
    tap: resolveTarget(o.whileTap, o.variants),
  })

  let resolved = resolveAll(opts)
  let currentValues: MotionValues | undefined = resolved.initial ?? resolved.animate

  const targetValues = (): MotionValues | undefined => {
    if (tapping && resolved.tap) return resolved.tap
    if (hovering && resolved.hover) return resolved.hover
    return resolved.animate
  }

  const cancelCurrent = (): void => {
    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }
    controls = null
  }
  const cancelStartTimer = (): void => {
    if (startTimer !== null) {
      clearTimeout(startTimer)
      startTimer = null
    }
  }

  const runTween = (from: MotionValues, to: MotionValues): void => {
    const tweenProps = buildTweenProps(from, to)
    if (Object.keys(tweenProps).length === 0) return
    const transition = currentOpts.transition
    cancelCurrent()
    cancelStartTimer()
    const start = (): void => {
      const resolved = resolveTransition(transition)
      const def = tween(tweenProps, {
        duration: resolved.duration,
        ...omitUndefined({ easing: resolved.easing }),
      })
      const playOpts: PlayOpts = omitUndefined({ backend: transition?.backend })
      controls = play(def, [node as unknown as StrategyTarget], playOpts)
    }
    const delay = transition?.delay ?? 0
    if (delay > 0) {
      startTimer = setTimeout(() => {
        startTimer = null
        start()
      }, delay)
    } else {
      start()
    }
  }

  const driveToTarget = (): void => {
    const next = targetValues()
    if (!next) return
    const from = currentValues ?? resolved.initial ?? next
    if (shallowEqualValues(from, next)) return
    runTween(from, next)
    currentValues = next
  }

  const onPointerEnter = (): void => {
    hovering = true
    if (resolved.hover) driveToTarget()
  }
  const onPointerLeave = (): void => {
    hovering = false
    tapping = false
    if (resolved.hover || resolved.tap) driveToTarget()
  }
  const onPointerDown = (): void => {
    tapping = true
    if (resolved.tap) driveToTarget()
  }
  const onPointerUp = (): void => {
    tapping = false
    if (resolved.tap) driveToTarget()
  }
  const onPointerCancel = onPointerUp

  const onGroupChange = (v: VariantTarget | undefined): void => {
    if (groupValue === v) return
    groupValue = v
    if (!mounted) {
      resolved = resolveAll(currentOpts)
      currentValues = resolved.initial ?? resolved.animate
      return
    }
    if (currentOpts.animate !== undefined) return
    resolved = resolveAll(currentOpts)
    const next = targetValues()
    if (!next) return
    const from = currentValues ?? resolved.initial ?? next
    if (shallowEqualValues(from, next)) return
    runTween(from, next)
    currentValues = next
  }

  const subscribeGroup = (g: MotionGroupStore | undefined): void => {
    if (g === currentGroup) return
    if (unsubscribeGroup) {
      unsubscribeGroup()
      unsubscribeGroup = null
    }
    currentGroup = g
    groupValue = undefined
    if (g) {
      unsubscribeGroup = g.subscribe(onGroupChange)
    }
  }

  let pointerListenersAttached = false
  const attachPointerListeners = (): void => {
    if (pointerListenersAttached) return
    if (!resolved.hover && !resolved.tap) return
    if (resolved.hover) {
      node.addEventListener("pointerenter", onPointerEnter)
      node.addEventListener("pointerleave", onPointerLeave)
    }
    if (resolved.tap) {
      node.addEventListener("pointerdown", onPointerDown)
      node.addEventListener("pointerup", onPointerUp)
      node.addEventListener("pointercancel", onPointerCancel)
    }
    pointerListenersAttached = true
  }
  const detachPointerListeners = (): void => {
    if (!pointerListenersAttached) return
    node.removeEventListener("pointerenter", onPointerEnter)
    node.removeEventListener("pointerleave", onPointerLeave)
    node.removeEventListener("pointerdown", onPointerDown)
    node.removeEventListener("pointerup", onPointerUp)
    node.removeEventListener("pointercancel", onPointerCancel)
    pointerListenersAttached = false
  }

  subscribeGroup(opts.group)

  if (resolved.initial) applyInline(node, resolved.initial)
  if (resolved.animate) {
    const from = resolved.initial ?? resolved.animate
    runTween(from, resolved.animate)
    currentValues = resolved.animate
  }
  attachPointerListeners()
  mounted = true

  return {
    update(next) {
      currentOpts = next
      subscribeGroup(next.group)
      const prev = resolved
      resolved = resolveAll(next)
      // Re-attach listeners if the hover/tap surface changed.
      const hoverTapChanged =
        Boolean(prev.hover) !== Boolean(resolved.hover) ||
        Boolean(prev.tap) !== Boolean(resolved.tap)
      if (hoverTapChanged) {
        detachPointerListeners()
        attachPointerListeners()
      }
      const next_ = targetValues()
      if (!next_) return
      const from = currentValues ?? resolved.initial ?? next_
      if (shallowEqualValues(from, next_)) return
      runTween(from, next_)
      currentValues = next_
    },
    destroy() {
      if (unsubscribeGroup) {
        unsubscribeGroup()
        unsubscribeGroup = null
      }
      currentGroup = undefined
      detachPointerListeners()
      cancelStartTimer()
      cancelCurrent()
    },
  }
}
