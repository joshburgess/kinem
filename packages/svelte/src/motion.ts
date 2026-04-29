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

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "@kinem/core"
import { omitUndefined, play, tween } from "@kinem/core"

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
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
  /** Delay in ms before the tween starts. */
  readonly delay?: number
}

export interface MotionActionOpts {
  readonly variants?: Variants
  readonly initial?: VariantTarget
  readonly animate?: VariantTarget
  readonly whileHover?: VariantTarget
  readonly whileTap?: VariantTarget
  readonly transition?: MotionTransition
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

  const resolveAll = (
    o: MotionActionOpts,
  ): {
    initial: MotionValues | undefined
    animate: MotionValues | undefined
    hover: MotionValues | undefined
    tap: MotionValues | undefined
  } => ({
    initial: resolveTarget(o.initial, o.variants),
    animate: resolveTarget(o.animate, o.variants),
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
      const def = tween(tweenProps, {
        duration: transition?.duration ?? 400,
        ...omitUndefined({ easing: transition?.easing }),
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

  if (resolved.initial) applyInline(node, resolved.initial)
  if (resolved.animate) {
    const from = resolved.initial ?? resolved.animate
    runTween(from, resolved.animate)
    currentValues = resolved.animate
  }
  attachPointerListeners()

  return {
    update(next) {
      currentOpts = next
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
      detachPointerListeners()
      cancelStartTimer()
      cancelCurrent()
    },
  }
}
