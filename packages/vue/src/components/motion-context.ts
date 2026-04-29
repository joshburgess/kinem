/**
 * Vue inject key that lets a parent `<Motion>` propagate its current
 * variant key (or array of keys) to descendant `<Motion>` components
 * that have their own `variants` map but no explicit `animate`. The
 * descendant resolves the inherited key against its own variants, so a
 * single parent flip can drive children with the same vocabulary.
 *
 * Stagger. When the parent declares `transition.staggerChildren > 0`,
 * the context also carries a stagger plan: `staggerMs` and a shared
 * mount-order counter. Each inheriting descendant claims an index from
 * the counter on its first setup and uses `index * staggerMs` as the
 * delay before its tween starts.
 */

import type { InjectionKey, Ref } from "vue"

export type MotionAnimateKey = string | readonly string[] | null

export interface MotionStaggerInfo {
  readonly staggerMs: number
  readonly counter: { current: number }
}

export interface MotionAnimateContextValue {
  readonly key: MotionAnimateKey
  readonly stagger: MotionStaggerInfo | null
}

/** Reactive ref so descendants pick up parent animate-key changes. */
export const MotionAnimateKey: InjectionKey<Ref<MotionAnimateContextValue | null>> =
  Symbol("kinem.motion.animate")
