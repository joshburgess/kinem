/**
 * `<Motion>` is a declarative wrapper around `play()`. It renders a
 * host element (configurable via the `as` prop) and drives animation
 * via a template ref.
 *
 *   <Motion as="div" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
 *           :transition="{ duration: 400 }" />
 *
 * Variants. Pass a `variants` map of named `MotionValues` and use a
 * string key for `initial`, `animate`, `exit`, `whileHover`, or
 * `whileTap` to drive a declarative state machine:
 *
 *   const v = { closed: { opacity: 0 }, open: { opacity: 1 } }
 *   <Motion :variants="v" initial="closed" :animate="isOpen ? 'open' : 'closed'" />
 *
 * Parent-child propagation. A `<Motion>` whose `animate` is a key
 * provides that key (via `inject`) to descendants that have their own
 * `variants` but no explicit `animate`. The descendants resolve the
 * inherited key against their own map.
 *
 * whileHover / whileTap. Resolved values from these props temporarily
 * override `animate` while the pointer is over (hover) or pressed
 * (tap). Tap takes precedence over hover.
 *
 * The resolved `initial` object is applied as inline styles on first
 * render so the element paints at the starting state before any animation
 * frame runs.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "@kinem/core"
import { omitUndefined, play, resolveTransition, tween } from "@kinem/core"
import {
  type CSSProperties,
  type PropType,
  type Ref,
  computed,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  watch,
} from "vue"
import {
  type MotionAnimateContextValue,
  MotionAnimateKey,
  type MotionAnimateKey as MotionAnimateKeyType,
} from "./motion-context"
import { PresenceKey } from "./presence"

export type MotionValues = Readonly<Record<string, string | number>>

export type Variants = Readonly<Record<string, MotionValues>>

/**
 * What `initial`, `animate`, `exit`, `whileHover`, and `whileTap` accept:
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
  readonly velocity?: number
  readonly backend?: PlayOpts["backend"]
  /**
   * Per-element delay in ms before the tween starts. Composes with any
   * stagger delay inherited from a parent.
   */
  readonly delay?: number
  /**
   * When set on a parent `<Motion>`, descendants that inherit the
   * parent's animate key are staggered by `staggerChildren` ms in
   * mount order: the first child has zero delay, the second
   * `staggerChildren` ms, the third `2 * staggerChildren`, and so on.
   * Applies only to animate-key-driven changes; whileHover and
   * whileTap never stagger.
   */
  readonly staggerChildren?: number
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

export const Motion = defineComponent({
  name: "Motion",
  // We bind attrs explicitly in render. Disabling auto-inheritance is
  // load-bearing: when we extract pointer handlers out of attrs (so we
  // can wrap them), the default auto-merge would re-attach the original
  // user handler on top of ours, double-firing whileHover / whileTap.
  inheritAttrs: false,
  props: {
    as: { type: String, default: "div" },
    variants: { type: Object as PropType<Variants>, default: undefined },
    initial: { type: [Object, String, Array] as PropType<VariantTarget>, default: undefined },
    animate: { type: [Object, String, Array] as PropType<VariantTarget>, default: undefined },
    exit: { type: [Object, String, Array] as PropType<VariantTarget>, default: undefined },
    whileHover: {
      type: [Object, String, Array] as PropType<VariantTarget>,
      default: undefined,
    },
    whileTap: { type: [Object, String, Array] as PropType<VariantTarget>, default: undefined },
    transition: { type: Object as PropType<MotionTransition>, default: undefined },
  },
  setup(props, { slots, attrs }) {
    const elRef = shallowRef<Element | null>(null)
    let controls: Controls | null = null
    let startTimer: ReturnType<typeof setTimeout> | null = null
    const presence = inject(PresenceKey, null)
    const parentCtx = inject(MotionAnimateKey, null)

    const parentAnimateKey = computed<MotionAnimateKeyType>(() => parentCtx?.value?.key ?? null)
    const inheritingFromParent = computed<boolean>(
      () =>
        props.animate === undefined &&
        props.variants !== undefined &&
        parentAnimateKey.value != null,
    )

    const effectiveAnimate = computed<VariantTarget | undefined>(() => {
      if (props.animate !== undefined) return props.animate
      if (inheritingFromParent.value) return parentAnimateKey.value as VariantTarget
      return undefined
    })

    // Allocate a stagger index lazily on first setup if we are
    // inheriting the parent's key and the parent has set a stagger
    // schedule. The index is captured once and stable for the lifetime
    // of this component.
    const staggerIndex: number | null =
      inheritingFromParent.value && parentCtx?.value?.stagger
        ? parentCtx.value.stagger.counter.current++
        : null

    const hovering = ref(false)
    const tapping = ref(false)

    const resolvedInitial = computed(() => resolveTarget(props.initial, props.variants))
    const resolvedAnimate = computed(() => resolveTarget(effectiveAnimate.value, props.variants))
    const resolvedExit = computed(() => resolveTarget(props.exit, props.variants))
    const resolvedHover = computed(() => resolveTarget(props.whileHover, props.variants))
    const resolvedTap = computed(() => resolveTarget(props.whileTap, props.variants))

    // Tap > hover > animate. Track the source so we can decide whether
    // to apply parent stagger (stagger only fires for animate-key-driven
    // changes, never for pointer-driven hover/tap).
    type TargetSource = "tap" | "hover" | "animate"
    const targetSource = computed<TargetSource>(() => {
      if (tapping.value && resolvedTap.value) return "tap"
      if (hovering.value && resolvedHover.value) return "hover"
      return "animate"
    })
    const targetValues = computed<MotionValues | undefined>(() => {
      const src = targetSource.value
      if (src === "tap") return resolvedTap.value
      if (src === "hover") return resolvedHover.value
      return resolvedAnimate.value
    })

    let currentValues: MotionValues | undefined = resolvedInitial.value ?? resolvedAnimate.value

    // Stagger counter is held outside the computed so it survives re-runs
    // when only effectiveAnimate changes; existing children keep their
    // mount-order indices when the key flips.
    const staggerCounter = { current: 0 }

    const provideValue = computed<MotionAnimateContextValue | null>(() => {
      const key =
        effectiveAnimate.value !== undefined && isVariantKey(effectiveAnimate.value)
          ? effectiveAnimate.value
          : null
      if (key === null) return null
      const staggerMs = props.transition?.staggerChildren
      return {
        key,
        stagger: staggerMs && staggerMs > 0 ? { staggerMs, counter: staggerCounter } : null,
      }
    })

    // Provide as a ref so descendants reactively re-resolve when our
    // animate key changes.
    provide(MotionAnimateKey, provideValue as unknown as Ref<MotionAnimateContextValue | null>)

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
      const el = elRef.value
      if (!el) return null
      const tweenProps = buildTweenProps(from, to)
      if (Object.keys(tweenProps).length === 0) return null
      const transition = props.transition
      if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
        controls.cancel()
      }
      cancelStartTimer()

      const inheritedStagger =
        source === "animate" &&
        inheritingFromParent.value &&
        parentCtx?.value?.stagger &&
        staggerIndex !== null
          ? staggerIndex * parentCtx.value.stagger.staggerMs
          : 0
      const totalDelay = inheritedStagger + (transition?.delay ?? 0)

      const start = (): Controls => {
        const resolved = resolveTransition(transition)
        const def = tween(tweenProps, {
          duration: resolved.duration,
          ...omitUndefined({ easing: resolved.easing }),
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

    onMounted(() => {
      const target = targetValues.value
      if (!target) return
      const from = currentValues ?? resolvedInitial.value ?? target
      runTween(from, target, targetSource.value)
      currentValues = target
    })

    watch(targetValues, (next, prev) => {
      if (!next) return
      if (shallowEqualValues(next, prev)) return
      const from = currentValues ?? resolvedInitial.value ?? next
      if (shallowEqualValues(from, next)) return
      runTween(from, next, targetSource.value)
      currentValues = next
    })

    if (presence) {
      let exitStarted = false
      watch(
        () => presence.isPresent,
        (isPresent) => {
          if (isPresent || exitStarted) return
          exitStarted = true
          const el = elRef.value
          const from = currentValues ?? resolvedAnimate.value ?? resolvedInitial.value
          const exitVals = resolvedExit.value
          if (!el || !exitVals || !from) {
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
        { immediate: true },
      )
    }

    onBeforeUnmount(() => {
      cancelStartTimer()
      if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
        controls.cancel()
      }
      controls = null
    })

    return () => {
      const userStyle = (attrs.style as CSSProperties | undefined) ?? {}
      const mergedStyle: CSSProperties = {
        ...((resolvedInitial.value ?? {}) as CSSProperties),
        ...userStyle,
      }

      // Strip pointer attrs out of the spread so we don't end up with
      // both Vue's auto-merged listener-array and our own handler firing
      // the user's callback. We chain into the user's handler manually
      // when our while* prop is set, otherwise we forward it as-is.
      const {
        style: _style,
        onPointerenter: userOnPointerEnter,
        onPointerleave: userOnPointerLeave,
        onPointerdown: userOnPointerDown,
        onPointerup: userOnPointerUp,
        onPointercancel: userOnPointerCancel,
        ...restAttrs
      } = attrs as Record<string, unknown>

      const handlers: Record<string, (e: PointerEvent) => void> = {}
      const userEnter = userOnPointerEnter as ((e: PointerEvent) => void) | undefined
      const userLeave = userOnPointerLeave as ((e: PointerEvent) => void) | undefined
      const userDown = userOnPointerDown as ((e: PointerEvent) => void) | undefined
      const userUp = userOnPointerUp as ((e: PointerEvent) => void) | undefined
      const userCancel = userOnPointerCancel as ((e: PointerEvent) => void) | undefined

      if (props.whileHover !== undefined) {
        handlers["onPointerenter"] = (e) => {
          hovering.value = true
          userEnter?.(e)
        }
        handlers["onPointerleave"] = (e) => {
          hovering.value = false
          tapping.value = false
          userLeave?.(e)
        }
      } else {
        if (userEnter) handlers["onPointerenter"] = userEnter
        if (userLeave) handlers["onPointerleave"] = userLeave
      }
      if (props.whileTap !== undefined) {
        handlers["onPointerdown"] = (e) => {
          tapping.value = true
          userDown?.(e)
        }
        handlers["onPointerup"] = (e) => {
          tapping.value = false
          userUp?.(e)
        }
        handlers["onPointercancel"] = (e) => {
          tapping.value = false
          userCancel?.(e)
        }
      } else {
        if (userDown) handlers["onPointerdown"] = userDown
        if (userUp) handlers["onPointerup"] = userUp
        if (userCancel) handlers["onPointercancel"] = userCancel
      }

      return h(
        props.as,
        {
          ...restAttrs,
          ...handlers,
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
