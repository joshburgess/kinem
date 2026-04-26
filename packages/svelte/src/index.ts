/**
 * Svelte bindings for kinem. Provides a `use:motion` action,
 * a `spring` store whose value animates toward a target, and custom
 * transition functions compatible with Svelte's `transition:` directive.
 * Frame scheduling is handled by the core package; Svelte's reactivity
 * is never used to drive per-frame state.
 */

export { type GestureActionOpts, type GestureActionReturn, gesture } from "./gesture"
export { type MotionActionOpts, type MotionValues, motion } from "./motion"
export { type ScrollActionOpts, type ScrollActionReturn, scroll } from "./scroll"
export { type SpringStore, type SpringStoreOpts, spring } from "./spring"
export {
  type KinemTransitionFn,
  type KinemTransitionOpts,
  type KinemTransitionValues,
  kinemTransition,
} from "./transition"
