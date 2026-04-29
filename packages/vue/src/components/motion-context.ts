/**
 * Vue inject key that lets a parent `<Motion>` propagate its current
 * variant key (or array of keys) to descendant `<Motion>` components
 * that have their own `variants` map but no explicit `animate`. The
 * descendant resolves the inherited key against its own variants, so a
 * single parent flip can drive children with the same vocabulary.
 *
 * Carrying just the key (string or readonly string[]) keeps this context
 * decoupled from the parent's resolved values.
 */

import type { InjectionKey, Ref } from "vue"

export type MotionAnimateKey = string | readonly string[] | null

/** Reactive ref so descendants pick up parent animate-key changes. */
export const MotionAnimateKey: InjectionKey<Ref<MotionAnimateKey>> = Symbol("kinem.motion.animate")
