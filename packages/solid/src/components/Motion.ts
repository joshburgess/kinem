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
 * The component is built with Solid's hyperscript (`solid-js/h`) so the
 * Solid package can keep its no-JSX build pipeline. JSX usage in
 * consumer code Just Works because Solid components are functions.
 *
 * The `initial` object is applied as inline styles before the first
 * animation frame so the element paints at the starting state. On
 * mount, a tween from `initial` to `animate` plays. When the `animate`
 * prop changes, a new tween from the previous `animate` to the new one
 * replaces any in-flight animation.
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
import { type JSX, createEffect, on, onCleanup, onMount } from "solid-js"
// `solid-js/h` is the hyperscript helper. It returns a Solid JSX node.
// Using it lets this file stay as plain `.ts` so the package's existing
// (no-JSX) build pipeline doesn't need to change.
import h from "solid-js/h"
import type { CreatePresenceResult } from "../primitives/createPresence"

export type MotionValues = Readonly<Record<string, string | number>>

export interface MotionTransition {
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
}

export interface MotionProps {
  readonly as?: string
  readonly initial?: MotionValues
  readonly animate?: MotionValues
  readonly exit?: MotionValues
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
  let prevAnimate: MotionValues | undefined = props.initial ?? props.animate
  let mounted = false

  const cancelCurrent = (): void => {
    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }
    controls = null
  }

  const runTween = (from: MotionValues, to: MotionValues): Controls | null => {
    if (!el) return null
    const tweenProps = buildTweenProps(from, to)
    if (Object.keys(tweenProps).length === 0) return null
    const transition = props.transition
    const def = tween(tweenProps, {
      duration: transition?.duration ?? 400,
      ...omitUndefined({ easing: transition?.easing }),
    })
    const playOpts: PlayOpts = omitUndefined({ backend: transition?.backend })
    cancelCurrent()
    controls = play(def, [el as unknown as StrategyTarget], playOpts)
    return controls
  }

  onMount(() => {
    mounted = true
    const animate = props.animate
    if (!animate) return
    const from = prevAnimate ?? props.initial ?? animate
    runTween(from, animate)
    prevAnimate = animate
  })

  // Re-tween whenever `animate` changes after mount.
  createEffect(
    on(
      () => props.animate,
      (next) => {
        if (!mounted) return
        if (!next) return
        const from = prevAnimate ?? props.initial ?? next
        if (shallowEqualValues(next, from)) return
        runTween(from, next)
        prevAnimate = next
      },
      { defer: true },
    ),
  )

  // Presence: when isPresent flips false, run the exit tween and
  // notify the controller once it settles.
  if (props.presence) {
    const presence = props.presence
    let exitStarted = false
    createEffect(
      on(
        presence.isPresent,
        (isPresent) => {
          if (isPresent || exitStarted) return
          exitStarted = true
          const from = prevAnimate ?? props.animate ?? props.initial
          if (!props.exit || !from) {
            presence.safeToRemove()
            return
          }
          const c = runTween(from, props.exit)
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
    cancelCurrent()
  })

  const setRef = (node: Element): void => {
    el = node
    props.ref?.(node)
  }

  const tag = props.as ?? "div"
  const mergedStyle: JSX.CSSProperties = {
    ...((props.initial ?? {}) as JSX.CSSProperties),
    ...(props.style ?? {}),
  }
  // Forward unknown props as DOM attributes / event handlers, but strip
  // the motion-specific keys we already consumed.
  const passThrough: Record<string, unknown> = {}
  for (const key of Object.keys(props)) {
    if (
      key === "as" ||
      key === "initial" ||
      key === "animate" ||
      key === "exit" ||
      key === "transition" ||
      key === "presence" ||
      key === "style" ||
      key === "ref" ||
      key === "children"
    ) {
      continue
    }
    passThrough[key] = props[key]
  }
  return h(
    tag,
    { ...passThrough, ref: setRef, style: mergedStyle },
    props.children,
  ) as unknown as JSX.Element
}
