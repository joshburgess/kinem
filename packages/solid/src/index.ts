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
  type ReorderAxis,
  type ReorderGroupProps,
  type ReorderItemProps,
  ReorderGroup,
  ReorderItem,
} from "./components/Reorder"
export { ReorderContext } from "./components/reorder-context"
export {
  type AnimateTarget,
  type CreateAnimateAnimate,
  type CreateAnimateResult,
  createAnimate,
} from "./primitives/createAnimate"
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
  type CreateInViewOpts,
  type CreateInViewResult,
  createInView,
} from "./primitives/createInView"
export { createMotionValue } from "./primitives/createMotionValue"
export { createMotionValueEvent } from "./primitives/createMotionValueEvent"
export {
  createReducedMotion,
  prefersReducedMotion,
} from "./primitives/createReducedMotion"
export { type CreateScrollResult, createScroll } from "./primitives/createScroll"
export { type SpringValue, createSpring } from "./primitives/createSpring"
export { createTime } from "./primitives/createTime"
export { createTransform } from "./primitives/createTransform"
export { createVelocity } from "./primitives/createVelocity"
export { createCombine } from "./primitives/createCombine"
