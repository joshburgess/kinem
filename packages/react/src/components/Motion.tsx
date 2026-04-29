/**
 * `<Motion>` is a thin declarative wrapper around `play()`. It renders a
 * host element (configurable via `as`) and drives animation via a ref.
 *
 *   <Motion as="div" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 *           transition={{ duration: 400 }}>
 *     content
 *   </Motion>
 *
 * Variants. `variants` is a named map of `MotionValues`. When `variants`
 * is set, `initial`, `animate`, `exit`, `whileHover`, and `whileTap` may
 * each be either an inline `MotionValues` object, a string key into the
 * variants map, or an array of keys whose values are merged left-to-right
 * (later keys win):
 *
 *   const v = { closed: { x: -100, opacity: 0 }, open: { x: 0, opacity: 1 } }
 *   <Motion variants={v} initial="closed" animate={isOpen ? "open" : "closed"} />
 *
 * Parent-child propagation. A `<Motion>` whose `animate` is a string key
 * propagates that key down to descendant `<Motion>` components that have
 * their own `variants` map but no explicit `animate`. Each descendant
 * resolves the inherited key against its own variants, so a parent flip
 * from "closed" → "open" can drive children with the same vocabulary.
 *
 * whileHover / whileTap. When set, the resolved values from these props
 * temporarily override `animate` while the pointer is over the element
 * (hover) or pressed on it (tap). Tap takes precedence over hover.
 *
 * The resolved `initial` object is applied as inline styles on first
 * render so the element paints at the starting state before any animation
 * frame runs. React state is never updated during playback; all mutation
 * happens on the DOM node via refs.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "@kinem/core"
import { omitUndefined, play, tween } from "@kinem/core"
import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { MotionAnimateContext } from "./motion-context"
import { PresenceContext } from "./presence"

export type MotionValues = Readonly<Record<string, string | number>>

export type Variants = Readonly<Record<string, MotionValues>>

/**
 * What `initial`, `animate`, `exit`, `whileHover`, and `whileTap` accept:
 * inline values, a single variant key, or a list of keys merged in order
 * (later wins). String / array forms require a `variants` map; otherwise
 * they resolve to `undefined` and the prop is ignored.
 */
export type VariantTarget = MotionValues | string | readonly string[]

export interface MotionTransition {
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
}

type MotionOwnProps<E extends ElementType> = {
  readonly as?: E
  readonly variants?: Variants
  readonly initial?: VariantTarget
  readonly animate?: VariantTarget
  readonly exit?: VariantTarget
  readonly whileHover?: VariantTarget
  readonly whileTap?: VariantTarget
  readonly transition?: MotionTransition
  readonly motionRef?: Ref<Element>
}

export type MotionProps<E extends ElementType = "div"> = MotionOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof MotionOwnProps<E>>

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

function isVariantKey(t: VariantTarget): t is string | readonly string[] {
  return typeof t === "string" || Array.isArray(t)
}

function resolveTarget(
  target: VariantTarget | undefined,
  variants: Variants | undefined,
): MotionValues | undefined {
  if (target === undefined) return undefined
  if (typeof target === "string") {
    return variants?.[target]
  }
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

export function Motion<E extends ElementType = "div">(props: MotionProps<E>): ReactElement {
  const {
    as,
    variants,
    initial,
    animate,
    exit,
    whileHover,
    whileTap,
    transition,
    motionRef,
    style: userStyle,
    children,
    onPointerEnter: userOnPointerEnter,
    onPointerLeave: userOnPointerLeave,
    onPointerDown: userOnPointerDown,
    onPointerUp: userOnPointerUp,
    onPointerCancel: userOnPointerCancel,
    ...rest
  } = props as MotionOwnProps<E> & {
    style?: CSSProperties
    children?: import("react").ReactNode
    onPointerEnter?: (e: ReactPointerEvent<Element>) => void
    onPointerLeave?: (e: ReactPointerEvent<Element>) => void
    onPointerDown?: (e: ReactPointerEvent<Element>) => void
    onPointerUp?: (e: ReactPointerEvent<Element>) => void
    onPointerCancel?: (e: ReactPointerEvent<Element>) => void
  }

  const presence = useContext(PresenceContext)
  const parentAnimateKey = useContext(MotionAnimateContext)

  // A child inherits the parent's animate key only when it has its own
  // variants map and didn't pass an explicit animate of its own. This
  // keeps inheritance opt-in and avoids surprising children that don't
  // share the parent's variant vocabulary.
  const effectiveAnimate: VariantTarget | undefined =
    animate ?? (variants && parentAnimateKey != null ? parentAnimateKey : undefined)

  const [hovering, setHovering] = useState(false)
  const [tapping, setTapping] = useState(false)

  // Resolve each target against the variants map. We memo on identity of
  // each input so changing one doesn't churn unrelated work.
  const resolvedInitial = useMemo(() => resolveTarget(initial, variants), [initial, variants])
  const resolvedAnimate = useMemo(
    () => resolveTarget(effectiveAnimate, variants),
    [effectiveAnimate, variants],
  )
  const resolvedExit = useMemo(() => resolveTarget(exit, variants), [exit, variants])
  const resolvedHover = useMemo(() => resolveTarget(whileHover, variants), [whileHover, variants])
  const resolvedTap = useMemo(() => resolveTarget(whileTap, variants), [whileTap, variants])

  // Precedence: tap > hover > animate.
  const targetValues: MotionValues | undefined = tapping
    ? (resolvedTap ?? resolvedAnimate)
    : hovering
      ? (resolvedHover ?? resolvedAnimate)
      : resolvedAnimate

  const elRef = useRef<Element | null>(null)
  const controlsRef = useRef<Controls | null>(null)
  const currentValuesRef = useRef<MotionValues | undefined>(resolvedInitial ?? resolvedAnimate)
  const mountedRef = useRef(false)

  const setRef = (el: Element | null): void => {
    elRef.current = el
    if (typeof motionRef === "function") motionRef(el)
    else if (motionRef && "current" in motionRef) {
      ;(motionRef as { current: Element | null }).current = el
    }
  }

  useEffect(() => {
    const el = elRef.current
    if (!el || !targetValues) return
    const from = currentValuesRef.current ?? resolvedInitial ?? targetValues
    const unchanged = mountedRef.current && shallowEqualValues(from, targetValues)
    mountedRef.current = true
    if (unchanged) return

    const existing = controlsRef.current
    if (existing && existing.state !== "cancelled" && existing.state !== "finished") {
      existing.cancel()
    }

    const tweenProps = buildTweenProps(from, targetValues)
    if (Object.keys(tweenProps).length === 0) {
      currentValuesRef.current = targetValues
      return
    }

    const def = tween(tweenProps, {
      duration: transition?.duration ?? 400,
      ...omitUndefined({ easing: transition?.easing }),
    })
    const playOpts: PlayOpts = omitUndefined({ backend: transition?.backend })
    controlsRef.current = play(def, [el as unknown as StrategyTarget], playOpts)
    currentValuesRef.current = targetValues
  }, [targetValues, transition, resolvedInitial])

  useEffect(() => {
    if (!presence || presence.isPresent) return
    const el = elRef.current
    if (!el) {
      presence.safeToRemove()
      return
    }
    const existing = controlsRef.current
    if (existing && existing.state !== "cancelled" && existing.state !== "finished") {
      existing.cancel()
    }
    const from = currentValuesRef.current ?? resolvedAnimate ?? resolvedInitial
    if (!resolvedExit || !from) {
      presence.safeToRemove()
      return
    }
    const tweenProps = buildTweenProps(from, resolvedExit)
    if (Object.keys(tweenProps).length === 0) {
      presence.safeToRemove()
      return
    }
    const def = tween(tweenProps, {
      duration: transition?.duration ?? 400,
      ...omitUndefined({ easing: transition?.easing }),
    })
    const playOpts: PlayOpts = omitUndefined({ backend: transition?.backend })
    const controls = play(def, [el as unknown as StrategyTarget], playOpts)
    controlsRef.current = controls
    let removed = false
    const done = (): void => {
      if (removed) return
      removed = true
      presence.safeToRemove()
    }
    controls.finished.then(done, done)
  }, [presence, resolvedExit, resolvedAnimate, resolvedInitial, transition])

  useEffect(() => {
    return () => {
      const c = controlsRef.current
      if (c && c.state !== "cancelled" && c.state !== "finished") c.cancel()
      controlsRef.current = null
    }
  }, [])

  // Pointer handlers. We attach our own handler when the corresponding
  // while* prop is set, then call through to any user handler so `onClick`
  // / `onPointerDown` etc. continue to work.
  const onPointerEnter = whileHover
    ? (e: ReactPointerEvent<Element>): void => {
        setHovering(true)
        userOnPointerEnter?.(e)
      }
    : userOnPointerEnter
  const onPointerLeave = whileHover
    ? (e: ReactPointerEvent<Element>): void => {
        setHovering(false)
        // A drag/tap that escapes the element should not stay "tapping"
        // forever; pointerleave clears it too so visual state matches
        // pointer reality even when pointerup never fires.
        setTapping(false)
        userOnPointerLeave?.(e)
      }
    : userOnPointerLeave
  const onPointerDown = whileTap
    ? (e: ReactPointerEvent<Element>): void => {
        setTapping(true)
        userOnPointerDown?.(e)
      }
    : userOnPointerDown
  const onPointerUp = whileTap
    ? (e: ReactPointerEvent<Element>): void => {
        setTapping(false)
        userOnPointerUp?.(e)
      }
    : userOnPointerUp
  const onPointerCancel = whileTap
    ? (e: ReactPointerEvent<Element>): void => {
        setTapping(false)
        userOnPointerCancel?.(e)
      }
    : userOnPointerCancel

  const Tag = (as ?? "div") as ElementType
  const mergedStyle: CSSProperties = {
    ...(resolvedInitial as CSSProperties | undefined),
    ...userStyle,
  }

  // Provide the parent animate key only when our own animate is a key,
  // so descendants can opt into inheritance via their own variants map.
  const provided: string | readonly string[] | null =
    effectiveAnimate !== undefined && isVariantKey(effectiveAnimate) ? effectiveAnimate : null

  const wrappedChildren =
    provided !== null
      ? createElement(MotionAnimateContext.Provider, { value: provided }, children)
      : children

  return createElement(
    Tag,
    {
      ...(rest as Record<string, unknown>),
      ref: setRef,
      style: mergedStyle,
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
    },
    wrappedChildren,
  )
}
