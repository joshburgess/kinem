/**
 * Vue bindings for motif-animate. Composables and a Motion component
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
  type MotifTransitionHooks,
  type MotifTransitionPhase,
  type TransitionValues,
  type UseMotifTransitionOpts,
  useMotifTransition,
} from "./composables/useMotifTransition"
export { type SpringValue, useSpring } from "./composables/useSpring"
