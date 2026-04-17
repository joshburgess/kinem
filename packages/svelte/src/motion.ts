/**
 * `motion` is a Svelte action that runs a tween from `initial` to
 * `animate` when mounted and replaces in-flight animations when the
 * `animate` target changes.
 *
 *   <div use:motion={{ initial: { opacity: 0 }, animate: { opacity: 1 },
 *                      transition: { duration: 300 } }} />
 *
 * The `initial` values are written synchronously to the element's
 * inline style so the first paint lands at the starting frame. On
 * update, the action diffs the incoming `animate` object against the
 * previous one and starts a new tween whenever the object identity or
 * a key's value changes. Svelte's reactivity is not used to drive
 * per-frame state: mutation happens directly on the DOM node.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "motif-animate"
import { play, tween } from "motif-animate"

export type MotionValues = Readonly<Record<string, string | number>>

export interface MotionTransition {
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
}

export interface MotionActionOpts {
  readonly initial?: MotionValues
  readonly animate?: MotionValues
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
  let prevAnimate: MotionValues | undefined = opts.initial ?? opts.animate

  const cancelCurrent = (): void => {
    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }
    controls = null
  }

  const runTween = (from: MotionValues, to: MotionValues): void => {
    const tweenProps = buildTweenProps(from, to)
    if (Object.keys(tweenProps).length === 0) return
    const transition = currentOpts.transition
    const def = tween(tweenProps, {
      duration: transition?.duration ?? 400,
      ...(transition?.easing !== undefined ? { easing: transition.easing } : {}),
    })
    const playOpts: PlayOpts = {}
    if (transition?.backend !== undefined) {
      ;(playOpts as { backend?: PlayOpts["backend"] }).backend = transition.backend
    }
    cancelCurrent()
    controls = play(def, [node as unknown as StrategyTarget], playOpts)
  }

  if (opts.initial) applyInline(node, opts.initial)
  if (opts.animate) {
    const from = opts.initial ?? opts.animate
    runTween(from, opts.animate)
    prevAnimate = opts.animate
  }

  return {
    update(next) {
      currentOpts = next
      if (!next.animate) return
      if (shallowEqualValues(next.animate, prevAnimate)) return
      const from = prevAnimate ?? next.initial ?? next.animate
      runTween(from, next.animate)
      prevAnimate = next.animate
    },
    destroy() {
      cancelCurrent()
    },
  }
}
