/**
 * Context that lets a parent `<Motion>` propagate its current variant key
 * to descendant `<Motion>` components that share a `variants` map. A
 * descendant inherits the parent's `animate` key only when it has its own
 * `variants` prop and does not pass an explicit `animate` of its own.
 *
 * Stagger. When the parent declares `transition.staggerChildren > 0`,
 * the context also carries a stagger plan: `staggerMs` and a shared
 * mount-order counter. Each inheriting descendant claims an index from
 * the counter on its first render and uses `index * staggerMs` as the
 * delay before its tween starts. The counter is held in a ref so it
 * survives re-renders triggered by an animate-key flip.
 */

import { createContext } from "react"

export type MotionAnimateKey = string | readonly string[] | null

export interface MotionStaggerInfo {
  readonly staggerMs: number
  readonly counter: { current: number }
}

export interface MotionAnimateContextValue {
  readonly key: MotionAnimateKey
  readonly stagger: MotionStaggerInfo | null
}

export const MotionAnimateContext = createContext<MotionAnimateContextValue | null>(null)
