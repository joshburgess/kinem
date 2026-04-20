/**
 * Vue bindings for kinem. Composables and a Motion component
 * wrap the vanilla `play()` and related APIs. Animations run against
 * template refs via WAAPI or rAF; Vue's reactivity is never used to
 * drive per-frame state updates.
 */

export {
  type MotionTransition,
  type MotionValues,
  Motion,
} from "./components/Motion"
export {
  type UseAnimationResult,
  useAnimation,
} from "./composables/useAnimation"
export {
  type KinemTransitionHooks,
  type KinemTransitionPhase,
  type TransitionValues,
  type UseKinemTransitionOpts,
  useKinemTransition,
} from "./composables/useKinemTransition"
export { type UseScrollResult, useScroll } from "./composables/useScroll"
export { type SpringValue, useSpring } from "./composables/useSpring"
