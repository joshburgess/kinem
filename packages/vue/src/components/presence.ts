/**
 * Shared presence context for `<AnimatePresence>` and `<Motion>`. When a
 * child becomes "exiting", its nearest parent `<AnimatePresence>` flips
 * `isPresent` to false. The child is expected to play an exit animation
 * and then call `safeToRemove()` so the parent can drop the element
 * from the tree.
 *
 * Vue parity for the React `PresenceContext`. Implemented as a Vue
 * `inject` key so descendant `<Motion>` components can subscribe via
 * `inject(PresenceKey, null)`.
 */

import type { InjectionKey } from "vue"

export interface PresenceValue {
  readonly isPresent: boolean
  /** Child calls this once its exit animation has finished. */
  safeToRemove(): void
}

export const PresenceKey: InjectionKey<PresenceValue> = Symbol("kinem.presence")
