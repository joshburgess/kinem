/**
 * Svelte bindings for motif-animate. Provides a `use:motion` action,
 * a `spring` store whose value animates toward a target, and custom
 * transition functions compatible with Svelte's `transition:` directive.
 * Frame scheduling is handled by the core package; Svelte's reactivity
 * is never used to drive per-frame state.
 */

export { type MotionActionOpts, type MotionValues, motion } from "./motion"
export { type SpringStore, type SpringStoreOpts, spring } from "./spring"
export {
  type MotifTransitionFn,
  type MotifTransitionOpts,
  type MotifTransitionValues,
  motifTransition,
} from "./transition"
