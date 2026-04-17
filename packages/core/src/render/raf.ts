/**
 * rAF rendering backend. Drives an `AnimationDef<Record<string, ...>>`
 * against one or more DOM-like targets by committing the interpolated
 * values as CSS properties or SVG attributes each frame.
 *
 * All timing logic (progress, pause, resume, seek, reverse, speed,
 * cancel) lives in `timing.ts` so non-DOM drivers can share it. This
 * module is the DOM adapter: every tick, walk the targets and call
 * `applyValues`.
 */

import type { AnimationDef } from "../core/types"
import { type ElementShim, type PropertyValue, applyValues } from "./apply"
import { type TimingHandle, type TimingOpts, createTiming } from "./timing"

export type RafState = TimingHandle["state"]
export type RafHandle = TimingHandle
export type RafOpts = TimingOpts

export type PropertyMap = Readonly<Record<string, PropertyValue>>

export function playRaf(
  def: AnimationDef<PropertyMap>,
  targets: readonly ElementShim[],
  opts: RafOpts = {},
): RafHandle {
  return createTiming(
    def,
    (values) => {
      for (let i = 0; i < targets.length; i++) {
        const el = targets[i]
        if (el) applyValues(el, values)
      }
    },
    opts,
  )
}
