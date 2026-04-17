/**
 * `<Motion>` is a thin declarative wrapper around `play()`. It renders a
 * host element (configurable via `as`) and drives animation via a ref.
 *
 *   <Motion as="div" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 *           transition={{ duration: 400 }}>
 *     content
 *   </Motion>
 *
 * The `initial` object is applied as inline styles on first render so the
 * element paints at the starting state before any animation frame runs.
 * On mount, a tween from `initial` to `animate` is played. When the
 * `animate` object changes (by shallow-equal check) a new tween from the
 * previous `animate` to the new one replaces any in-flight animation.
 *
 * React state is never updated during playback; all mutation happens on
 * the DOM node via refs.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "motif-animate"
import { play, tween } from "motif-animate"
import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type Ref,
  createElement,
  useContext,
  useEffect,
  useRef,
} from "react"
import { PresenceContext } from "./presence"

export type MotionValues = Readonly<Record<string, string | number>>

export interface MotionTransition {
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
}

type MotionOwnProps<E extends ElementType> = {
  readonly as?: E
  readonly initial?: MotionValues
  readonly animate?: MotionValues
  readonly exit?: MotionValues
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
    initial,
    animate,
    exit,
    transition,
    motionRef,
    style: userStyle,
    ...rest
  } = props as MotionOwnProps<E> & { style?: CSSProperties }

  const presence = useContext(PresenceContext)
  const elRef = useRef<Element | null>(null)
  const controlsRef = useRef<Controls | null>(null)
  const prevAnimateRef = useRef<MotionValues | undefined>(initial ?? animate)
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
    if (!el || !animate) return
    const from = prevAnimateRef.current ?? initial ?? animate
    const unchanged = mountedRef.current && shallowEqualValues(from, animate)
    mountedRef.current = true
    if (unchanged) return

    const existing = controlsRef.current
    if (existing && existing.state !== "cancelled" && existing.state !== "finished") {
      existing.cancel()
    }

    const tweenProps = buildTweenProps(from, animate)
    if (Object.keys(tweenProps).length === 0) {
      prevAnimateRef.current = animate
      return
    }

    const def = tween(tweenProps, {
      duration: transition?.duration ?? 400,
      ...(transition?.easing !== undefined ? { easing: transition.easing } : {}),
    })
    const playOpts: PlayOpts = {}
    if (transition?.backend !== undefined) {
      ;(playOpts as { backend?: PlayOpts["backend"] }).backend = transition.backend
    }
    controlsRef.current = play(def, [el as unknown as StrategyTarget], playOpts)
    prevAnimateRef.current = animate
  }, [animate, initial, transition])

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
    const from = prevAnimateRef.current ?? animate ?? initial
    if (!exit || !from) {
      presence.safeToRemove()
      return
    }
    const tweenProps = buildTweenProps(from, exit)
    if (Object.keys(tweenProps).length === 0) {
      presence.safeToRemove()
      return
    }
    const def = tween(tweenProps, {
      duration: transition?.duration ?? 400,
      ...(transition?.easing !== undefined ? { easing: transition.easing } : {}),
    })
    const playOpts: PlayOpts = {}
    if (transition?.backend !== undefined) {
      ;(playOpts as { backend?: PlayOpts["backend"] }).backend = transition.backend
    }
    const controls = play(def, [el as unknown as StrategyTarget], playOpts)
    controlsRef.current = controls
    let removed = false
    const done = (): void => {
      if (removed) return
      removed = true
      presence.safeToRemove()
    }
    controls.finished.then(done, done)
  }, [presence, exit, animate, initial, transition])

  useEffect(() => {
    return () => {
      const c = controlsRef.current
      if (c && c.state !== "cancelled" && c.state !== "finished") c.cancel()
      controlsRef.current = null
    }
  }, [])

  const Tag = (as ?? "div") as ElementType
  const mergedStyle: CSSProperties = { ...(initial as CSSProperties | undefined), ...userStyle }

  return createElement(Tag, {
    ...(rest as Record<string, unknown>),
    ref: setRef,
    style: mergedStyle,
  })
}
