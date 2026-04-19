/**
 * `<Motion>` is a declarative wrapper around `play()`. It renders a
 * host element (configurable via the `as` prop) and drives animation
 * via a template ref.
 *
 *   <Motion as="div" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
 *           :transition="{ duration: 400 }" />
 *
 * The `initial` object is applied as inline styles on first render so
 * the element paints at the starting state before any animation frame
 * runs. On mount, a tween from `initial` to `animate` plays. When the
 * `animate` prop changes, a new tween from the previous `animate` to
 * the new one replaces any in-flight animation.
 *
 * Vue's reactivity is not used to drive per-frame state; mutation
 * happens directly on the DOM node via refs.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "@kinem/core"
import { play, tween } from "@kinem/core"
import {
  type CSSProperties,
  type PropType,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
} from "vue"

export type MotionValues = Readonly<Record<string, string | number>>

export interface MotionTransition {
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
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

export const Motion = defineComponent({
  name: "Motion",
  props: {
    as: { type: String, default: "div" },
    initial: { type: Object as PropType<MotionValues>, default: undefined },
    animate: { type: Object as PropType<MotionValues>, default: undefined },
    transition: { type: Object as PropType<MotionTransition>, default: undefined },
  },
  setup(props, { slots, attrs }) {
    const elRef = shallowRef<Element | null>(null)
    let controls: Controls | null = null
    let prevAnimate: MotionValues | undefined = props.initial ?? props.animate

    const runTween = (from: MotionValues, to: MotionValues): void => {
      const el = elRef.value
      if (!el) return
      const tweenProps = buildTweenProps(from, to)
      if (Object.keys(tweenProps).length === 0) return
      const transition = props.transition
      const def = tween(tweenProps, {
        duration: transition?.duration ?? 400,
        ...(transition?.easing !== undefined ? { easing: transition.easing } : {}),
      })
      const playOpts: PlayOpts = {}
      if (transition?.backend !== undefined) {
        ;(playOpts as { backend?: PlayOpts["backend"] }).backend = transition.backend
      }
      if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
        controls.cancel()
      }
      controls = play(def, [el as unknown as StrategyTarget], playOpts)
    }

    onMounted(() => {
      const animate = props.animate
      if (!animate) return
      const from = prevAnimate ?? props.initial ?? animate
      runTween(from, animate)
      prevAnimate = animate
    })

    watch(
      () => props.animate,
      (next, prev) => {
        if (!next) return
        if (shallowEqualValues(next, prev)) return
        const from = prevAnimate ?? prev ?? props.initial ?? next
        runTween(from, next)
        prevAnimate = next
      },
    )

    onBeforeUnmount(() => {
      if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
        controls.cancel()
      }
      controls = null
    })

    return () => {
      const userStyle = (attrs.style as CSSProperties | undefined) ?? {}
      const mergedStyle: CSSProperties = {
        ...(props.initial as CSSProperties | undefined),
        ...userStyle,
      }
      return h(
        props.as,
        {
          ...attrs,
          ref: (el: unknown) => {
            elRef.value = (el as Element | null) ?? null
          },
          style: mergedStyle,
        },
        slots["default"]?.(),
      )
    }
  },
})
