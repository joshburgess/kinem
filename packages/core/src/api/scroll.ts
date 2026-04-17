/**
 * Public `scroll()` entry point. Resolves targets the same way `play()`
 * does (selector / element / array / NodeList), then dispatches to one
 * of two drivers:
 *
 *   - `sync: true`  → `playScrollSync` (progress tracks scroll position)
 *   - otherwise     → `playScrollTriggered` (Controls driven by zone
 *                      transitions according to `toggleActions`)
 */

import type { AnimationDef } from "../core/types"
import type { AnimationProps, StrategyTarget } from "../render/strategy"
import { createDomScrollSource } from "../scroll/source"
import type { ScrollSource } from "../scroll/source"
import { type ScrollSyncHandle, type ScrollSyncOpts, playScrollSync } from "../scroll/sync"
import { type TriggerPos, parseTriggerPos } from "../scroll/trigger"
import {
  type ScrollTriggeredHandle,
  type ScrollTriggeredOpts,
  type ToggleActions,
  playScrollTriggered,
} from "../scroll/triggered"
import { type PlayOpts, type Target, resolveTargets } from "./play"

export interface ScrollTriggerConfig {
  readonly start?: string | TriggerPos
  readonly end?: string | TriggerPos
}

export interface ScrollOpts
  extends Omit<ScrollTriggeredOpts, "source" | "start" | "end" | "toggleActions">,
    Omit<ScrollSyncOpts, "source" | "start" | "end"> {
  /**
   * If true, progress tracks scroll position directly (scroll-linked).
   * If false or omitted, the animation is scroll-triggered: a regular
   * clock-based animation whose playback is controlled by scroll zone
   * transitions via `toggleActions`.
   */
  readonly sync?: boolean
  readonly trigger?: ScrollTriggerConfig
  readonly toggleActions?: string | ToggleActions
  /** Override the scroll environment (defaults to the global window). */
  readonly source?: ScrollSource
  /** Selector resolver override (see `play()`). */
  readonly resolve?: PlayOpts["resolve"]
}

const DEFAULT_START = "top 80%"
const DEFAULT_END = "bottom 20%"

export type ScrollHandle = ScrollSyncHandle | ScrollTriggeredHandle

export function scroll(
  def: AnimationDef<AnimationProps>,
  target: Target,
  opts: ScrollOpts = {},
): ScrollHandle {
  const playOpts: PlayOpts = opts.resolve ? { resolve: opts.resolve } : {}
  const targets: readonly StrategyTarget[] = resolveTargets(target, playOpts)
  const source = opts.source ?? createDomScrollSource()
  const start = parseTriggerPos(opts.trigger?.start ?? DEFAULT_START)
  const end = parseTriggerPos(opts.trigger?.end ?? DEFAULT_END)

  if (opts.sync) {
    return playScrollSync(def, targets, {
      source,
      start,
      end,
      ...(opts.scheduler ? { scheduler: opts.scheduler } : {}),
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
    })
  }

  return playScrollTriggered(def, targets, {
    ...opts,
    source,
    start,
    end,
    ...(opts.toggleActions !== undefined ? { toggleActions: opts.toggleActions } : {}),
  })
}
