/**
 * Scroll-triggered animation driver.
 *
 * A regular time-based animation is created up front via `playStrategy`
 * but paused immediately; subsequent scroll position changes dispatch
 * one of four actions (`onEnter`, `onLeave`, `onEnterBack`, `onLeaveBack`)
 * to the `Controls` handle, mirroring GSAP's ScrollTrigger `toggleActions`
 * convention.
 *
 * Zone transitions:
 *   - before → active : onEnter
 *   - active → after  : onLeave
 *   - after  → active : onEnterBack
 *   - active → before : onLeaveBack
 * Jumps that skip the active zone fire both boundary events in order.
 */

import { type Controls, createControls } from "../api/controls"
import { KinemError } from "../core/errors"
import type { AnimationDef } from "../core/types"
import { isTrackerEnabled, trackAnimation } from "../devtools/tracker"
import {
  type AnimationProps,
  type StrategyOpts,
  type StrategyTarget,
  playStrategy,
} from "../render/strategy"
import type { FrameScheduler } from "../scheduler/frame"
import { frame as defaultFrame } from "../scheduler/frame"
import type { ScrollSource } from "./source"
import {
  type ScrollBounds,
  type ScrollZone,
  type TriggerPos,
  computeBounds,
  zoneAt,
} from "./trigger"

export type ToggleAction =
  | "play"
  | "pause"
  | "resume"
  | "reverse"
  | "reset"
  | "restart"
  | "complete"
  | "none"

export type ToggleActions = readonly [ToggleAction, ToggleAction, ToggleAction, ToggleAction]

const DEFAULT_TOGGLE_ACTIONS: ToggleActions = ["play", "none", "none", "reverse"]

const ALL_ACTIONS: readonly ToggleAction[] = [
  "play",
  "pause",
  "resume",
  "reverse",
  "reset",
  "restart",
  "complete",
  "none",
]

function isToggleAction(s: string): s is ToggleAction {
  return (ALL_ACTIONS as readonly string[]).includes(s)
}

export function parseToggleActions(input: string | ToggleActions): ToggleActions {
  if (typeof input !== "string") return input
  const parts = input.trim().split(/\s+/)
  if (parts.length !== 4) {
    throw new KinemError(
      `scroll: toggleActions must have 4 entries (got "${input}")`,
      'format is "onEnter onLeave onEnterBack onLeaveBack", e.g. "play pause resume reset"',
    )
  }
  for (const p of parts) {
    if (!isToggleAction(p)) {
      throw new KinemError(
        `scroll: invalid toggle action "${p}"`,
        'allowed: "play", "pause", "resume", "reverse", "restart", "reset", "complete", "none"',
      )
    }
  }
  return parts as unknown as ToggleActions
}

type ZoneEvent = "enter" | "leave" | "enterBack" | "leaveBack"

function eventsFor(from: ScrollZone, to: ScrollZone): readonly ZoneEvent[] {
  if (from === to) return []
  if (from === "before" && to === "active") return ["enter"]
  if (from === "active" && to === "after") return ["leave"]
  if (from === "before" && to === "after") return ["enter", "leave"]
  if (from === "after" && to === "active") return ["enterBack"]
  if (from === "active" && to === "before") return ["leaveBack"]
  if (from === "after" && to === "before") return ["enterBack", "leaveBack"]
  return []
}

function actionFor(event: ZoneEvent, actions: ToggleActions): ToggleAction {
  switch (event) {
    case "enter":
      return actions[0]
    case "leave":
      return actions[1]
    case "enterBack":
      return actions[2]
    case "leaveBack":
      return actions[3]
  }
}

function applyAction(action: ToggleAction, controls: Controls): void {
  switch (action) {
    case "play":
    case "resume":
      controls.resume()
      return
    case "pause":
      controls.pause()
      return
    case "reverse":
      controls.reverse()
      controls.resume()
      return
    case "reset":
      controls.pause()
      controls.seek(0)
      return
    case "restart":
      controls.seek(0)
      controls.resume()
      return
    case "complete":
      controls.pause()
      controls.seek(1)
      return
    case "none":
      return
  }
}

export type ScrollTriggeredState = "idle" | "active" | "cancelled"

export interface ScrollTriggeredHandle {
  cancel(): void
  readonly controls: Controls
  readonly state: ScrollTriggeredState
}

export interface ScrollTriggeredOpts extends StrategyOpts {
  readonly source: ScrollSource
  readonly start: TriggerPos
  readonly end: TriggerPos
  readonly toggleActions?: string | ToggleActions
  readonly scheduler?: FrameScheduler
}

export function playScrollTriggered(
  def: AnimationDef<AnimationProps>,
  targets: readonly StrategyTarget[],
  opts: ScrollTriggeredOpts,
): ScrollTriggeredHandle {
  const actions = parseToggleActions(opts.toggleActions ?? DEFAULT_TOGGLE_ACTIONS)

  const handle = playStrategy(def, targets, opts)
  const controls = createControls(handle, def.duration)
  controls.pause()
  controls.seek(0)

  // Scroll-triggered animations don't go through `play()`, so we
  // register them with the tracker here. Backend label is "scroll" so
  // devtools can distinguish them from clock-driven animations even
  // though the underlying handle is a normal time-based one.
  if (isTrackerEnabled()) {
    trackAnimation(controls, targets, "scroll")
  }

  let state: ScrollTriggeredState = "idle"
  let bounds: ScrollBounds | null = null
  let currentZone: ScrollZone = "before"

  const measure = (): void => {
    const anchor = targets[0]
    if (!anchor) return
    const rect = opts.source.getRect(anchor)
    bounds = computeBounds(opts.start, opts.end, {
      elementTop: rect.top,
      elementHeight: rect.height,
      viewportHeight: opts.source.getViewportHeight(),
    })
  }

  const sync = (): void => {
    if (state === "cancelled") return
    if (!bounds) measure()
    if (!bounds) return
    const next = zoneAt(opts.source.getScrollY(), bounds)
    if (next === currentZone) return
    const events = eventsFor(currentZone, next)
    currentZone = next
    if (state === "idle") state = "active"
    for (const ev of events) applyAction(actionFor(ev, actions), controls)
  }

  measure()
  sync()

  const unsubScroll = opts.source.onScroll(sync)
  const unsubResize = opts.source.onResize(() => {
    bounds = null
    sync()
  })

  return {
    cancel() {
      if (state === "cancelled") return
      state = "cancelled"
      unsubScroll()
      unsubResize()
      controls.cancel()
    },
    get controls() {
      return controls
    },
    get state() {
      return state
    },
  }
}
