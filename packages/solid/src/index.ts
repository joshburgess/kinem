/**
 * Solid bindings for kinem. The public surface is a thin set of
 * primitives (`create*`) that wrap the vanilla `play()` / gesture /
 * scroll APIs, plus a `<Motion>` component for declarative usage.
 * Animations run against DOM refs via WAAPI or rAF; Solid signals are
 * never written during playback, so animations do not trigger
 * reactivity churn.
 */

export {
  type MotionProps,
  type MotionTransition,
  type MotionValues,
  type VariantTarget,
  type Variants,
  Motion,
} from "./components/Motion"
export {
  type CreateAnimationResult,
  createAnimation,
} from "./primitives/createAnimation"
export {
  type CreateGestureOpts,
  type CreateGestureResult,
  createGesture,
} from "./primitives/createGesture"
export {
  type CreateLayoutOpts,
  type CreateLayoutResult,
  createLayout,
} from "./primitives/createLayout"
export {
  type CreatePresenceResult,
  createPresence,
} from "./primitives/createPresence"
export {
  createReducedMotion,
  prefersReducedMotion,
} from "./primitives/createReducedMotion"
export { type CreateScrollResult, createScroll } from "./primitives/createScroll"
export { type SpringValue, createSpring } from "./primitives/createSpring"
