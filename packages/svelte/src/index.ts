/**
 * Svelte bindings for kinem. Provides a `use:motion` action,
 * a `spring` store whose value animates toward a target, and custom
 * transition functions compatible with Svelte's `transition:` directive.
 * Frame scheduling is handled by the core package; Svelte's reactivity
 * is never used to drive per-frame state.
 */

export { type AnimateTarget, type KinemAnimateApi, kinemAnimate } from "./animate"
export { type GestureActionOpts, type GestureActionReturn, gesture } from "./gesture"
export { type InViewActionOpts, type InViewActionReturn, inView } from "./in-view"
export { type LayoutActionOpts, type LayoutActionReturn, layout } from "./layout"
export {
  type MotionActionOpts,
  type MotionGroupStore,
  type MotionValues,
  type VariantTarget,
  type Variants,
  motion,
  motionGroup,
} from "./motion"
export {
  type CombinedMotionValueStore,
  type MotionValueStore,
  combine,
  motionValue,
  transform,
} from "./motion-value"
export { type MotionValueEventName, motionValueEvent } from "@kinem/core"
export {
  type CreatePresenceOpts,
  type PresenceController,
  type PresenceReadable,
  createPresence,
} from "./presence"
export {
  type ReducedMotionStore,
  createReducedMotionStore,
  prefersReducedMotion,
  reducedMotion,
} from "./reduced-motion"
export {
  type ReorderAxis,
  type ReorderGroupActionOpts,
  type ReorderGroupActionReturn,
  type ReorderItemActionOpts,
  type ReorderItemActionReturn,
  reorderGroup,
  reorderItem,
} from "./reorder"
export { type ScrollActionOpts, type ScrollActionReturn, scroll } from "./scroll"
export { type SpringStore, type SpringStoreOpts, spring } from "./spring"
export { type TimeMotionValueStore, time } from "./time"
export {
  type KinemTransitionFn,
  type KinemTransitionOpts,
  type KinemTransitionValues,
  kinemTransition,
} from "./transition"
export { type VelocityMotionValueStore, velocity } from "./velocity"
