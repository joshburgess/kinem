/**
 * Scroll-linked animation driver.
 *
 * Unlike the time-based backends, this driver does not own a clock;
 * its progress is sampled from the scroll position of a `ScrollSource`
 * on every scroll/resize event. Values are applied with `applyValues`
 * directly (not through WAAPI) because the browser-side compositor
 * path for scroll-driven timelines is CSS `animation-timeline`, which
 * is handled by a separate optimization layer.
 *
 * Scroll and resize events are coalesced through the shared frame
 * scheduler: each event flips a `dirty` flag and schedules a single
 * job in the `update` phase, so multiple scroll events between frames
 * collapse into one render.
 */

import type { AnimationDef } from "../core/types"
import { isTrackerEnabled, trackAmbient, untrackAmbient } from "../devtools/tracker"
import { applyValues } from "../render/apply"
import type { AnimationProps, StrategyTarget } from "../render/strategy"
import type { FrameScheduler } from "../scheduler/frame"
import { frame as defaultFrame } from "../scheduler/frame"
import type { ScrollSource } from "./source"
import { type ScrollBounds, type TriggerPos, computeBounds, progressAt } from "./trigger"

export type ScrollSyncState = "active" | "cancelled"

export interface ScrollSyncHandle {
  cancel(): void
  readonly state: ScrollSyncState
  /** Current normalized progress in [0, 1]. */
  readonly progress: number
}

export interface ScrollSyncOpts {
  readonly source: ScrollSource
  readonly start: TriggerPos
  readonly end: TriggerPos
  readonly scheduler?: FrameScheduler
  /** Called whenever progress changes. Useful for per-frame side effects. */
  readonly onProgress?: (progress: number) => void
}

export function playScrollSync(
  def: AnimationDef<AnimationProps>,
  targets: readonly StrategyTarget[],
  opts: ScrollSyncOpts,
): ScrollSyncHandle {
  const scheduler = opts.scheduler ?? defaultFrame

  let state: ScrollSyncState = "active"
  let bounds: ScrollBounds | null = null
  let progress = 0
  let dirty = true

  const measure = (): void => {
    const anchor = targets[0]
    if (!anchor) {
      bounds = null
      return
    }
    const rect = opts.source.getRect(anchor)
    bounds = computeBounds(opts.start, opts.end, {
      elementTop: rect.top,
      elementHeight: rect.height,
      viewportHeight: opts.source.getViewportHeight(),
    })
  }

  const render = (): void => {
    if (state === "cancelled" || !dirty) return
    if (!bounds) measure()
    if (!bounds) return
    progress = progressAt(opts.source.getScrollY(), bounds)
    const values = def.interpolate(progress)
    for (const t of targets) applyValues(t, values)
    opts.onProgress?.(progress)
    dirty = false
  }

  const markDirty = (): void => {
    if (state === "cancelled") return
    dirty = true
    scheduler.schedule("update", render)
  }

  const invalidate = (): void => {
    bounds = null
    markDirty()
  }

  markDirty()

  const unsubScroll = opts.source.onScroll(markDirty)
  const unsubResize = opts.source.onResize(invalidate)

  let trackerId = -1
  const handle: ScrollSyncHandle = {
    cancel() {
      if (state === "cancelled") return
      state = "cancelled"
      unsubScroll()
      unsubResize()
      scheduler.cancel("update", render)
      untrackAmbient(trackerId)
    },
    get state() {
      return state
    },
    get progress() {
      return progress
    },
  }

  if (isTrackerEnabled()) {
    trackerId = trackAmbient(handle, "scroll", targets)
  }

  return handle
}
