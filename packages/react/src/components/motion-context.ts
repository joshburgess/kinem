/**
 * Context that lets a parent `<Motion>` propagate its current variant key
 * to descendant `<Motion>` components that share a `variants` map. A
 * descendant inherits the parent's `animate` key only when it has its own
 * `variants` prop and does not pass an explicit `animate` of its own.
 *
 * Carrying just the key (string or readonly string[]) keeps this context
 * decoupled from the parent's resolved values: each descendant looks up
 * its own variants map with the inherited key.
 */

import { createContext } from "react"

export type MotionAnimateKey = string | readonly string[] | null

export const MotionAnimateContext = createContext<MotionAnimateKey>(null)
