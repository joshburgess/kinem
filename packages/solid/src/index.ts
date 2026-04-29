/**
 * Solid bindings for kinem. The public surface is a thin set of
 * primitives (`create*`) that wrap the vanilla `play()` / gesture /
 * scroll APIs. Animations run against DOM refs via WAAPI or rAF; Solid
 * signals are never written during playback, so animations do not
 * trigger reactivity churn.
 */

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
  createReducedMotion,
  prefersReducedMotion,
} from "./primitives/createReducedMotion"
export { type CreateScrollResult, createScroll } from "./primitives/createScroll"
export { type SpringValue, createSpring } from "./primitives/createSpring"
