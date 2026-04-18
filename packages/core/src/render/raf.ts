/**
 * rAF rendering backend. Drives an `AnimationDef<Record<string, ...>>`
 * against one or more DOM-like targets by committing the interpolated
 * values as CSS properties or SVG attributes each frame.
 *
 * All timing logic (progress, pause, resume, seek, reverse, speed,
 * cancel) lives in `timing.ts` so non-DOM drivers can share it. This
 * module is the DOM adapter: every tick, walk the targets and commit.
 *
 * When the def carries a pre-classified `commit(p, el)` path (set by
 * `tween()`), we skip `def.interpolate()` and the per-frame
 * `applyValues()` classify-and-branch loop, writing values directly
 * to each target with one pass.
 */

import type { AnimationDef } from "../core/types"
import { type ElementShim, type PropertyValue, applyValues } from "./apply"
import {
  type TimingHandle,
  type TimingOpts,
  createTiming,
  createTimingDirect,
} from "./timing"

export type RafState = TimingHandle["state"]
export type RafHandle = TimingHandle
export type RafOpts = TimingOpts

export type PropertyMap = Readonly<Record<string, PropertyValue>>

export function playRaf(
  def: AnimationDef<PropertyMap>,
  targets: readonly ElementShim[],
  opts: RafOpts = {},
): RafHandle {
  const directCommit = def.commit
  if (directCommit) {
    return createTimingDirect(
      def,
      (progress) => {
        for (let i = 0; i < targets.length; i++) {
          const el = targets[i]
          if (el) directCommit(progress, el)
        }
      },
      opts,
    )
  }
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
