/**
 * `Motion` is a declarative wrapper around `play()` for Solid. It
 * renders a host element (configurable via the `as` prop) and drives
 * animation via a ref, mirroring the React `<Motion>` and Vue `<Motion>`
 * components.
 *
 *   import { Motion } from "@kinem/solid"
 *
 *   <Motion as="div" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 *           transition={{ duration: 400 }}>
 *     content
 *   </Motion>
 *
 * Variants. `variants` is a named map of `MotionValues`. When set, the
 * `initial`, `animate`, `exit`, `whileHover`, and `whileTap` props may
 * each be inline values, a single variant key, or an array of keys
 * merged left-to-right (later wins):
 *
 *   const v = { closed: { x: -100, opacity: 0 }, open: { x: 0, opacity: 1 } }
 *   <Motion variants={v} initial="closed" animate={open() ? "open" : "closed"} />
 *
 * Parent-child propagation. A `<Motion>` whose `animate` is a key
 * propagates that key (via context) to descendants that have their own
 * `variants` map but no explicit `animate`. The descendant resolves the
 * inherited key against its own map.
 *
 * whileHover / whileTap. Resolved values from these props temporarily
 * override `animate` while the pointer is over (hover) or pressed
 * (tap). Tap takes precedence over hover.
 *
 * The component is built with Solid's hyperscript (`solid-js/h`) so the
 * Solid package can keep its no-JSX build pipeline.
 *
 * Solid signals are never written during playback; mutation happens
 * directly on the DOM node.
 *
 * Presence integration: when rendered inside a `createPresence`-driven
 * `<Show>` block, set `presence` to the controller. When `presence.isPresent()`
 * flips false, `Motion` plays its `exit` tween (or no-op if absent) and
 * calls `presence.safeToRemove()` once the animation settles.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "@kinem/core"
import { omitUndefined, play, tween } from "@kinem/core"
import {
  type JSX,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  useContext,
} from "solid-js"
// `solid-js/h` is the hyperscript helper. It returns a Solid JSX node.
// Using it lets this file stay as plain `.ts` so the package's existing
// (no-JSX) build pipeline doesn't need to change.
import h from "solid-js/h"
import type { CreatePresenceResult } from "../primitives/createPresence"
import { MotionAnimateContext, type MotionAnimateContextValue } from "./motion-context"

export type MotionValues = Readonly<Record<string, string | number>>

export type Variants = Readonly<Record<string, MotionValues>>

export type VariantTarget = MotionValues | string | readonly string[]

export interface MotionTransition {
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
  /**
   * Per-element delay in ms before the tween starts. Composes with any
   * stagger delay inherited from a parent.
   */
  readonly delay?: number
  /**
   * When set on a parent `<Motion>`, descendants that inherit the
   * parent's animate key are staggered by `staggerChildren` ms in
   * mount order.
   */
  readonly staggerChildren?: number
}

export interface MotionProps {
  readonly as?: string
  readonly variants?: Variants
  readonly initial?: VariantTarget
  readonly animate?: VariantTarget
  readonly exit?: VariantTarget
  readonly whileHover?: VariantTarget
  readonly whileTap?: VariantTarget
  readonly transition?: MotionTransition
  /**
   * Optional presence controller from `createPresence(...)`. When
   * provided and `presence.isPresent()` is false, `Motion` plays the
   * `exit` tween (or skips if `exit` is unset) and calls
   * `presence.safeToRemove()` once the animation settles.
   */
  readonly presence?: CreatePresenceResult
  readonly style?: JSX.CSSProperties
  readonly class?: string
  readonly children?: JSX.Element
  readonly ref?: (el: Element) => void
  readonly [attr: string]: unknown
}

function isVariantKey(t: VariantTarget): t is string | readonly string[] {
  return typeof t === "string" || Array.isArray(t)
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

export function Motion(props: MotionProps): JSX.Element {
  let el: Element | null = null
  let controls: Controls | null = null
  let mounted = false
  let startTimer: ReturnType<typeof setTimeout> | null = null

  const parentCtx = useContext(MotionAnimateContext)

  const inheritingFromParent = createMemo<boolean>(
    () =>
      props.animate === undefined &&
      props.variants !== undefined &&
      (parentCtx()?.key ?? null) != null,
  )

  // A child inherits the parent's animate key only when it has its own
  // variants map and didn't pass an explicit animate of its own.
  const effectiveAnimate = createMemo<VariantTarget | undefined>(() => {
    if (props.animate !== undefined) return props.animate
    if (inheritingFromParent()) return parentCtx()?.key as VariantTarget
    return undefined
  })

  // Allocate a stagger index lazily on first setup if we are inheriting
  // and the parent has a stagger schedule. The index is captured once.
  const initialCtx = parentCtx()
  const staggerIndex: number | null =
    inheritingFromParent() && initialCtx?.stagger ? initialCtx.stagger.counter.current++ : null

  const [hovering, setHovering] = createSignal(false)
  const [tapping, setTapping] = createSignal(false)

  const resolvedInitial = createMemo(() => resolveTarget(props.initial, props.variants))
  const resolvedAnimate = createMemo(() => resolveTarget(effectiveAnimate(), props.variants))
  const resolvedExit = createMemo(() => resolveTarget(props.exit, props.variants))
  const resolvedHover = createMemo(() => resolveTarget(props.whileHover, props.variants))
  const resolvedTap = createMemo(() => resolveTarget(props.whileTap, props.variants))

  // Tap > hover > animate. Track the source so stagger applies only to
  // animate-key-driven changes.
  type TargetSource = "tap" | "hover" | "animate"
  const targetSource = createMemo<TargetSource>(() => {
    if (tapping() && resolvedTap()) return "tap"
    if (hovering() && resolvedHover()) return "hover"
    return "animate"
  })
  const targetValues = createMemo<MotionValues | undefined>(() => {
    const src = targetSource()
    if (src === "tap") return resolvedTap()
    if (src === "hover") return resolvedHover()
    return resolvedAnimate()
  })

  let currentValues: MotionValues | undefined = resolvedInitial() ?? resolvedAnimate()

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

  const runTween = (
    from: MotionValues,
    to: MotionValues,
    source: TargetSource,
  ): Controls | null => {
    if (!el) return null
    const tweenProps = buildTweenProps(from, to)
    if (Object.keys(tweenProps).length === 0) return null
    const transition = props.transition
    cancelCurrent()
    cancelStartTimer()

    const ctx = parentCtx()
    const inheritedStagger =
      source === "animate" && inheritingFromParent() && ctx?.stagger && staggerIndex !== null
        ? staggerIndex * ctx.stagger.staggerMs
        : 0
    const totalDelay = inheritedStagger + (transition?.delay ?? 0)

    const start = (): Controls => {
      const def = tween(tweenProps, {
        duration: transition?.duration ?? 400,
        ...omitUndefined({ easing: transition?.easing }),
      })
      const playOpts: PlayOpts = omitUndefined({ backend: transition?.backend })
      controls = play(def, [el as unknown as StrategyTarget], playOpts)
      return controls
    }
    if (totalDelay > 0) {
      startTimer = setTimeout(() => {
        startTimer = null
        start()
      }, totalDelay)
      return null
    }
    return start()
  }

  onMount(() => {
    mounted = true
    const target = targetValues()
    if (!target) return
    const from = currentValues ?? resolvedInitial() ?? target
    runTween(from, target, targetSource())
    currentValues = target
  })

  // Re-tween whenever the resolved target changes after mount.
  createEffect(
    on(
      targetValues,
      (next, prev) => {
        if (!mounted) return
        if (!next) return
        if (shallowEqualValues(next, prev)) return
        const from = currentValues ?? resolvedInitial() ?? next
        if (shallowEqualValues(from, next)) return
        runTween(from, next, targetSource())
        currentValues = next
      },
      { defer: true },
    ),
  )

  // Presence: when isPresent flips false, run the exit tween and notify
  // the controller once it settles.
  if (props.presence) {
    const presence = props.presence
    let exitStarted = false
    createEffect(
      on(
        presence.isPresent,
        (isPresent) => {
          if (isPresent || exitStarted) return
          exitStarted = true
          const from = currentValues ?? resolvedAnimate() ?? resolvedInitial()
          const exitVals = resolvedExit()
          if (!exitVals || !from) {
            presence.safeToRemove()
            return
          }
          const c = runTween(from, exitVals, "animate")
          if (!c) {
            presence.safeToRemove()
            return
          }
          let removed = false
          const done = (): void => {
            if (removed) return
            removed = true
            presence.safeToRemove()
          }
          c.finished.then(done, done)
        },
        { defer: true },
      ),
    )
  }

  onCleanup(() => {
    cancelStartTimer()
    cancelCurrent()
  })

  const setRef = (node: Element): void => {
    el = node
    props.ref?.(node)
  }

  const tag = props.as ?? "div"
  const mergedStyle: JSX.CSSProperties = {
    ...((resolvedInitial() ?? {}) as JSX.CSSProperties),
    ...(props.style ?? {}),
  }

  // Forward unknown props as DOM attributes / event handlers, but strip
  // the motion-specific keys we already consumed and the pointer
  // handlers we wrap below.
  const passThrough: Record<string, unknown> = {}
  let userOnPointerEnter: ((e: PointerEvent) => void) | undefined
  let userOnPointerLeave: ((e: PointerEvent) => void) | undefined
  let userOnPointerDown: ((e: PointerEvent) => void) | undefined
  let userOnPointerUp: ((e: PointerEvent) => void) | undefined
  let userOnPointerCancel: ((e: PointerEvent) => void) | undefined

  for (const key of Object.keys(props)) {
    if (
      key === "as" ||
      key === "variants" ||
      key === "initial" ||
      key === "animate" ||
      key === "exit" ||
      key === "whileHover" ||
      key === "whileTap" ||
      key === "transition" ||
      key === "presence" ||
      key === "style" ||
      key === "ref" ||
      key === "children"
    ) {
      continue
    }
    if (key === "onPointerEnter" || key === "onpointerenter") {
      userOnPointerEnter = props[key] as (e: PointerEvent) => void
      continue
    }
    if (key === "onPointerLeave" || key === "onpointerleave") {
      userOnPointerLeave = props[key] as (e: PointerEvent) => void
      continue
    }
    if (key === "onPointerDown" || key === "onpointerdown") {
      userOnPointerDown = props[key] as (e: PointerEvent) => void
      continue
    }
    if (key === "onPointerUp" || key === "onpointerup") {
      userOnPointerUp = props[key] as (e: PointerEvent) => void
      continue
    }
    if (key === "onPointerCancel" || key === "onpointercancel") {
      userOnPointerCancel = props[key] as (e: PointerEvent) => void
      continue
    }
    passThrough[key] = props[key]
  }

  if (props.whileHover !== undefined) {
    passThrough["onPointerEnter"] = (e: PointerEvent): void => {
      setHovering(true)
      userOnPointerEnter?.(e)
    }
    passThrough["onPointerLeave"] = (e: PointerEvent): void => {
      setHovering(false)
      setTapping(false)
      userOnPointerLeave?.(e)
    }
  } else {
    if (userOnPointerEnter) passThrough["onPointerEnter"] = userOnPointerEnter
    if (userOnPointerLeave) passThrough["onPointerLeave"] = userOnPointerLeave
  }
  if (props.whileTap !== undefined) {
    passThrough["onPointerDown"] = (e: PointerEvent): void => {
      setTapping(true)
      userOnPointerDown?.(e)
    }
    passThrough["onPointerUp"] = (e: PointerEvent): void => {
      setTapping(false)
      userOnPointerUp?.(e)
    }
    passThrough["onPointerCancel"] = (e: PointerEvent): void => {
      setTapping(false)
      userOnPointerCancel?.(e)
    }
  } else {
    if (userOnPointerDown) passThrough["onPointerDown"] = userOnPointerDown
    if (userOnPointerUp) passThrough["onPointerUp"] = userOnPointerUp
    if (userOnPointerCancel) passThrough["onPointerCancel"] = userOnPointerCancel
  }

  // Provide the parent animate key only when our own animate is a key,
  // so descendants can opt into inheritance via their own variants map.
  // The stagger counter is held outside the memo so it survives re-runs
  // when only effectiveAnimate changes.
  const staggerCounter = { current: 0 }
  const provideValue = createMemo<MotionAnimateContextValue | null>(() => {
    const a = effectiveAnimate()
    const key = a !== undefined && isVariantKey(a) ? a : null
    if (key === null) return null
    const staggerMs = props.transition?.staggerChildren
    return {
      key,
      stagger: staggerMs && staggerMs > 0 ? { staggerMs, counter: staggerCounter } : null,
    }
  })

  const node = h(
    tag,
    { ...passThrough, ref: setRef, style: mergedStyle },
    props.children,
  ) as unknown as JSX.Element

  return h(MotionAnimateContext.Provider, { value: provideValue }, node) as unknown as JSX.Element
}
