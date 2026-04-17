/**
 * Drag gesture driver.
 *
 * Pointer down on a target enters the `dragging` phase: pointer movement
 * updates a 2D offset and writes it to the targets' `x`/`y` pseudo-
 * transform properties. Pointer up enters `releasing`, during which the
 * offset tweens toward either the nearest snap point or the origin
 * (depending on configuration). Re-grabbing during a release cancels it
 * and continues the drag from the current offset.
 *
 * Velocity is tracked via `createVelocityTracker` across the drag so
 * callers can read it in `onEnd`. The release animation is driven by
 * the shared frame scheduler (keepalive on `update`) rather than through
 * the animation `play()` pipeline, because the offset is local state
 * that must remain live-editable across phases.
 */

import { applyValues } from "../render/apply"
import type { StrategyTarget } from "../render/strategy"
import type { Clock } from "../scheduler/clock"
import { defaultClock } from "../scheduler/clock"
import type { FrameScheduler } from "../scheduler/frame"
import { frame as defaultFrame } from "../scheduler/frame"
import type {
  Point,
  PointerBindTarget,
  PointerEventShim,
  PointerSource,
  PointerUnsubscribe,
} from "./pointer"
import { createDomPointerSource, createVelocityTracker } from "./pointer"

export type DragAxis = "x" | "y" | "both"

export type DragPhase = "idle" | "dragging" | "releasing" | "cancelled"

export interface DragBounds {
  readonly left?: number
  readonly right?: number
  readonly top?: number
  readonly bottom?: number
}

export interface DragSnap {
  readonly points: readonly Point[]
  /**
   * Max distance (in px) between the release point and a snap point at
   * which the release will snap to that point. If no point is within
   * `threshold`, the drag releases to origin (if `release` is set) or
   * stays in place.
   */
  readonly threshold?: number
}

export interface DragReleaseOpts {
  /**
   * Duration of the return-to-origin or snap animation, in ms. Default 400.
   */
  readonly duration?: number
}

export interface DragEvent {
  readonly offset: Point
  readonly velocity: Point
  readonly pointerEvent: PointerEventShim
}

export interface DragOpts {
  readonly target: PointerBindTarget
  readonly axis?: DragAxis
  readonly bounds?: DragBounds
  readonly snap?: DragSnap
  /**
   * Enable release-to-origin spring when no snap matches. Pass any
   * object to enable with defaults; pass `false` (the default) to leave
   * the element at the drop position.
   */
  readonly release?: DragReleaseOpts | false
  readonly source?: PointerSource
  readonly scheduler?: FrameScheduler
  readonly clock?: Clock
  /** Apply `touch-action` CSS to the target. Default `true`. */
  readonly applyTouchAction?: boolean
  readonly onStart?: (ev: DragEvent) => void
  readonly onMove?: (ev: DragEvent) => void
  readonly onEnd?: (ev: DragEvent) => void
}

export interface DragHandle {
  cancel(): void
  readonly phase: DragPhase
  readonly offset: Point
  readonly velocity: Point
}

interface StyleCapable {
  readonly style?: { setProperty(name: string, value: string): void }
}

function touchActionFor(axis: DragAxis): string {
  if (axis === "x") return "pan-y"
  if (axis === "y") return "pan-x"
  return "none"
}

function clamp(value: number, lo: number | undefined, hi: number | undefined): number {
  if (lo !== undefined && value < lo) return lo
  if (hi !== undefined && value > hi) return hi
  return value
}

function applyBounds(offset: Point, bounds: DragBounds | undefined, axis: DragAxis): Point {
  if (!bounds) return offset
  return {
    x: axis === "y" ? 0 : clamp(offset.x, bounds.left, bounds.right),
    y: axis === "x" ? 0 : clamp(offset.y, bounds.top, bounds.bottom),
  }
}

function nearestSnap(offset: Point, snap: DragSnap): Point | null {
  const threshold = snap.threshold ?? Number.POSITIVE_INFINITY
  let best: Point | null = null
  let bestDist = threshold
  for (const p of snap.points) {
    const dist = Math.hypot(p.x - offset.x, p.y - offset.y)
    if (dist <= bestDist) {
      bestDist = dist
      best = p
    }
  }
  return best
}

function renderOffset(targets: readonly StrategyTarget[], offset: Point): void {
  for (const t of targets) applyValues(t, { x: offset.x, y: offset.y })
}

export function playDrag(targets: readonly StrategyTarget[], opts: DragOpts): DragHandle {
  const axis: DragAxis = opts.axis ?? "both"
  const scheduler = opts.scheduler ?? defaultFrame
  const clock = opts.clock ?? defaultClock
  const source = opts.source ?? createDomPointerSource()
  const applyTouchAction = opts.applyTouchAction !== false

  if (applyTouchAction) {
    const styled = opts.target as StyleCapable
    styled.style?.setProperty("touch-action", touchActionFor(axis))
  }

  const velocity = createVelocityTracker()

  let phase: DragPhase = "idle"
  let offset: Point = { x: 0, y: 0 }
  let dragStart: Point = { x: 0, y: 0 }
  let dragStartOffset: Point = { x: 0, y: 0 }
  let activePointerId: number | null = null

  let releaseFrom: Point = { x: 0, y: 0 }
  let releaseTo: Point = { x: 0, y: 0 }
  let releaseStartTime = 0
  let releaseDuration = 0
  let releaseActive = false

  const releaseStep = (): void => {
    if (!releaseActive || phase === "cancelled") return
    const t = clock.now()
    const elapsed = t - releaseStartTime
    const raw = releaseDuration <= 0 ? 1 : elapsed / releaseDuration
    const p = raw <= 0 ? 0 : raw >= 1 ? 1 : raw
    // ease-out cubic
    const eased = 1 - (1 - p) ** 3
    const next: Point = {
      x: releaseFrom.x + (releaseTo.x - releaseFrom.x) * eased,
      y: releaseFrom.y + (releaseTo.y - releaseFrom.y) * eased,
    }
    offset = next
    renderOffset(targets, next)
    if (p >= 1) {
      releaseActive = false
      scheduler.cancel("update", releaseStep)
      phase = "idle"
    }
  }

  const startRelease = (ev: PointerEventShim): void => {
    const snapTarget = opts.snap ? nearestSnap(offset, opts.snap) : null
    const releaseCfg = opts.release
    const hasRelease = releaseCfg !== false && releaseCfg !== undefined
    const target: Point | null = snapTarget ?? (hasRelease ? { x: 0, y: 0 } : null)

    opts.onEnd?.({
      offset,
      velocity: velocity.velocity(),
      pointerEvent: ev,
    })

    if (!target) {
      phase = "idle"
      return
    }

    const duration = hasRelease ? (releaseCfg.duration ?? 400) : 400
    releaseFrom = offset
    releaseTo = applyBounds(target, opts.bounds, axis)
    releaseStartTime = clock.now()
    releaseDuration = duration
    releaseActive = true
    phase = "releasing"
    scheduler.schedule("update", releaseStep, { keepalive: true })
  }

  const onStart = (ev: PointerEventShim): void => {
    if (phase === "cancelled") return
    if (releaseActive) {
      releaseActive = false
      scheduler.cancel("update", releaseStep)
    }
    activePointerId = ev.pointerId
    dragStart = { x: ev.clientX, y: ev.clientY }
    dragStartOffset = offset
    velocity.reset()
    velocity.record({ x: ev.clientX, y: ev.clientY, time: ev.timeStamp })
    phase = "dragging"
    opts.onStart?.({
      offset,
      velocity: velocity.velocity(),
      pointerEvent: ev,
    })
  }

  const onMove = (ev: PointerEventShim): void => {
    if (phase !== "dragging" || ev.pointerId !== activePointerId) return
    const raw: Point = {
      x: axis === "y" ? 0 : dragStartOffset.x + (ev.clientX - dragStart.x),
      y: axis === "x" ? 0 : dragStartOffset.y + (ev.clientY - dragStart.y),
    }
    const next = applyBounds(raw, opts.bounds, axis)
    offset = next
    velocity.record({ x: ev.clientX, y: ev.clientY, time: ev.timeStamp })
    renderOffset(targets, next)
    opts.onMove?.({
      offset,
      velocity: velocity.velocity(),
      pointerEvent: ev,
    })
  }

  const onEnd = (ev: PointerEventShim): void => {
    if (phase !== "dragging" || ev.pointerId !== activePointerId) return
    activePointerId = null
    startRelease(ev)
  }

  const onCancel = (ev: PointerEventShim): void => {
    if (phase !== "dragging" || ev.pointerId !== activePointerId) return
    activePointerId = null
    opts.onEnd?.({
      offset,
      velocity: velocity.velocity(),
      pointerEvent: ev,
    })
    phase = "idle"
  }

  const unsub: PointerUnsubscribe = source.bind(opts.target, {
    onStart,
    onMove,
    onEnd,
    onCancel,
  })

  return {
    cancel() {
      if (phase === "cancelled") return
      phase = "cancelled"
      if (releaseActive) {
        releaseActive = false
        scheduler.cancel("update", releaseStep)
      }
      unsub()
    },
    get phase() {
      return phase
    },
    get offset() {
      return offset
    },
    get velocity() {
      return velocity.velocity()
    },
  }
}
