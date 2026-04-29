/**
 * Solid context that lets a parent `<Motion>` propagate its current
 * variant key (or array of keys) to descendant `<Motion>` components
 * that have their own `variants` map but no explicit `animate`. The
 * descendant resolves the inherited key against its own variants, so a
 * parent flip can drive children with the same vocabulary.
 *
 * Carrying the key as an `Accessor<...>` so descendants reactively
 * re-resolve when the parent's animate key changes.
 */

import { type Accessor, createContext } from "solid-js"

export type MotionAnimateKey = string | readonly string[] | null

export const MotionAnimateContext = createContext<Accessor<MotionAnimateKey>>(() => null)
