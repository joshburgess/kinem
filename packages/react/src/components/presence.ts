/**
 * Shared context for `<AnimatePresence>` and `<Motion>`. When a child
 * becomes "exiting", its nearest parent `AnimatePresence` flips
 * `isPresent` to false. Children are expected to play an exit
 * animation and then call `safeToRemove()` so the parent can drop the
 * element from the tree.
 *
 * Leaving this module self-contained keeps the import graph clean
 * between the Motion and AnimatePresence components and avoids a
 * circular dependency.
 */

import { createContext } from "react"

export interface PresenceValue {
  readonly isPresent: boolean
  /** Child calls this once its exit animation has finished. */
  safeToRemove(): void
}

export const PresenceContext = createContext<PresenceValue | null>(null)
