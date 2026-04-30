/**
 * Vue bindings for kinem. Composables and a Motion component
 * wrap the vanilla `play()` and related APIs. Animations run against
 * template refs via WAAPI or rAF; Vue's reactivity is never used to
 * drive per-frame state updates.
 */

export { AnimatePresence } from "./components/AnimatePresence"
export {
  type MotionTransition,
  type MotionValues,
  type VariantTarget,
  type Variants,
  Motion,
} from "./components/Motion"
export { PresenceKey, type PresenceValue } from "./components/presence"
export { type ReorderAxis, ReorderGroup, ReorderItem } from "./components/Reorder"
export { ReorderKey } from "./components/reorder-context"
export {
  type AnimateTarget,
  type UseAnimateAnimate,
  type UseAnimateResult,
  useAnimate,
} from "./composables/useAnimate"
export {
  type UseAnimationResult,
  useAnimation,
} from "./composables/useAnimation"
export {
  type UseGestureOpts,
  type UseGestureResult,
  useGesture,
} from "./composables/useGesture"
export {
  type KinemTransitionHooks,
  type KinemTransitionPhase,
  type TransitionValues,
  type UseKinemTransitionOpts,
  useKinemTransition,
} from "./composables/useKinemTransition"
export {
  type UseLayoutOpts,
  type UseLayoutResult,
  useLayout,
} from "./composables/useLayout"
export { type UseInViewOpts, type UseInViewResult, useInView } from "./composables/useInView"
export { useMotionValue } from "./composables/useMotionValue"
export { useMotionValueEvent } from "./composables/useMotionValueEvent"
export {
  prefersReducedMotion,
  useReducedMotion,
} from "./composables/useReducedMotion"
export { type UseScrollResult, useScroll } from "./composables/useScroll"
export { type SpringValue, useSpring } from "./composables/useSpring"
export { useTime } from "./composables/useTime"
export { useTransform } from "./composables/useTransform"
export { useVelocity } from "./composables/useVelocity"
export { useCombine } from "./composables/useCombine"
