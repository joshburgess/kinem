/**
 * React bindings for kinem. The public surface is a thin set of
 * hooks and components that wrap the vanilla `play()` / gesture / scroll
 * APIs. Animations run against DOM refs via WAAPI or rAF; React state is
 * never touched during playback, so animations do not drive re-renders.
 */

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
export { type UseScrollResult, useScroll } from "./hooks/useScroll"
export { type SpringValue, useSpring } from "./hooks/useSpring"
export { AnimatePresence, type AnimatePresenceProps } from "./components/AnimatePresence"
export {
  Motion,
  type MotionProps,
  type MotionTransition,
  type MotionValues,
} from "./components/Motion"
