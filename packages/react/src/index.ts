/**
 * React bindings for kinem. The public surface is a thin set of
 * hooks and components that wrap the vanilla `play()` / gesture / scroll
 * APIs. Animations run against DOM refs via WAAPI or rAF; React state is
 * never touched during playback, so animations do not drive re-renders.
 */

export {
  type AnimateTarget,
  type UseAnimateAnimate,
  type UseAnimateResult,
  useAnimate,
} from "./hooks/useAnimate"
export { type UseAnimationResult, useAnimation } from "./hooks/useAnimation"
export {
  type UseGestureOpts,
  type UseGestureResult,
  useGesture,
} from "./hooks/useGesture"
export {
  type UseLayoutOpts,
  type UseLayoutResult,
  useLayout,
} from "./hooks/useLayout"
export { type UseInViewOpts, type UseInViewResult, useInView } from "./hooks/useInView"
export { useMotionValue } from "./hooks/useMotionValue"
export { useMotionValueEvent } from "./hooks/useMotionValueEvent"
export { prefersReducedMotion, useReducedMotion } from "./hooks/useReducedMotion"
export { type UseScrollResult, useScroll } from "./hooks/useScroll"
export { type SpringValue, useSpring } from "./hooks/useSpring"
export { useTime } from "./hooks/useTime"
export { useTransform } from "./hooks/useTransform"
export { useVelocity } from "./hooks/useVelocity"
export { AnimatePresence, type AnimatePresenceProps } from "./components/AnimatePresence"
export {
  Reorder,
  type ReorderAxis,
  type ReorderGroupProps,
  type ReorderItemProps,
} from "./components/Reorder"
export {
  Motion,
  type MotionProps,
  type MotionTransition,
  type MotionValues,
  type VariantTarget,
  type Variants,
} from "./components/Motion"
