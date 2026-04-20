/**
 * Gesture recognizers: tap, press, pan, pinch.
 *
 * These are pure input observers. Unlike `drag` and `hover` they do not
 * drive the render pipeline — they bind to a `PointerBindTarget` and
 * report semantic gesture events to user callbacks. Higher-level helpers
 * can route those events into animations via `play()` when desired.
 *
 * Tap and press are single-pointer recognizers distinguished by duration:
 * a tap is a quick down/up within `maxDuration` and `maxMovement`; a
 * press is the pointer held past `minDuration` without leaving the
 * movement threshold. Pan is a continuous single-pointer gesture that
 * emits `onMove` once cumulative movement exceeds `threshold`. Pinch
 * tracks two simultaneous pointers and reports scale and rotation
 * deltas relative to the moment the second pointer arrived.
 */

import type { Clock } from "../scheduler/clock"
import { defaultClock } from "../scheduler/clock"
import type {
  Point,
  PointerBindTarget,
  PointerEventShim,
  PointerSource,
  PointerUnsubscribe,
} from "./pointer"
import { createDomPointerSource, createVelocityTracker } from "./pointer"

export type RecognizerState = "idle" | "tracking" | "active" | "cancelled"

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export interface Timer {
  set(cb: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const DEFAULT_TIMER: Timer = {
  set: (cb, ms) => {
    const g = globalThis as { setTimeout?: (cb: () => void, ms: number) => unknown }
    if (!g.setTimeout) throw new Error("recognizer: no setTimeout available")
    return g.setTimeout(cb, ms)
  },
  clear: (h) => {
    const g = globalThis as { clearTimeout?: (h: unknown) => void }
    g.clearTimeout?.(h)
  },
}

// -----------------------------------------------------------------------
// Tap
// -----------------------------------------------------------------------

export interface TapEvent {
  readonly point: Point
  readonly duration: number
  readonly pointerEvent: PointerEventShim
}

export interface TapOpts {
  readonly target: PointerBindTarget
  readonly source?: PointerSource
  readonly clock?: Clock
  /** Max duration in ms for a tap. Default 250. */
  readonly maxDuration?: number
  /** Max movement in px from pointerdown; exceeding cancels the tap. Default 10. */
  readonly maxMovement?: number
  readonly onTap?: (ev: TapEvent) => void
}

export interface TapHandle {
  cancel(): void
  readonly state: Exclude<RecognizerState, "active">
}

export function playTap(opts: TapOpts): TapHandle {
  const source = opts.source ?? createDomPointerSource()
  const clock = opts.clock ?? defaultClock
  const maxDuration = opts.maxDuration ?? 250
  const maxMovement = opts.maxMovement ?? 10

  let state: Exclude<RecognizerState, "active"> = "idle"
  let startPoint: Point = { x: 0, y: 0 }
  let startTime = 0
  let activePointerId: number | null = null

  const reset = (): void => {
    activePointerId = null
  }

  const unsub: PointerUnsubscribe = source.bind(opts.target, {
    onStart(ev) {
      if (state === "cancelled") return
      if (activePointerId !== null) return
      activePointerId = ev.pointerId
      startPoint = { x: ev.clientX, y: ev.clientY }
      startTime = clock.now()
      state = "tracking"
    },
    onMove(ev) {
      if (state !== "tracking" || ev.pointerId !== activePointerId) return
      if (distance({ x: ev.clientX, y: ev.clientY }, startPoint) > maxMovement) {
        state = "idle"
        reset()
      }
    },
    onEnd(ev) {
      if (state !== "tracking" || ev.pointerId !== activePointerId) return
      const duration = clock.now() - startTime
      const end: Point = { x: ev.clientX, y: ev.clientY }
      const ok = duration <= maxDuration && distance(end, startPoint) <= maxMovement
      state = "idle"
      reset()
      if (ok) {
        opts.onTap?.({ point: end, duration, pointerEvent: ev })
      }
    },
    onCancel(ev) {
      if (ev.pointerId !== activePointerId) return
      state = "idle"
      reset()
    },
  })

  return {
    cancel() {
      if (state === "cancelled") return
      state = "cancelled"
      reset()
      unsub()
    },
    get state() {
      return state
    },
  }
}

// -----------------------------------------------------------------------
// Press (long-press)
// -----------------------------------------------------------------------

export interface PressEvent {
  readonly point: Point
  readonly duration: number
  readonly pointerEvent: PointerEventShim
}

export interface PressOpts {
  readonly target: PointerBindTarget
  readonly source?: PointerSource
  readonly timer?: Timer
  /** Duration in ms the pointer must be held. Default 500. */
  readonly minDuration?: number
  /** Max movement in px during the press; exceeding cancels it. Default 10. */
  readonly maxMovement?: number
  readonly onPress?: (ev: PressEvent) => void
  readonly onCancel?: () => void
}

export interface PressHandle {
  cancel(): void
  readonly state: RecognizerState
}

export function playPress(opts: PressOpts): PressHandle {
  const source = opts.source ?? createDomPointerSource()
  const timer = opts.timer ?? DEFAULT_TIMER
  const minDuration = opts.minDuration ?? 500
  const maxMovement = opts.maxMovement ?? 10

  let state: RecognizerState = "idle"
  let startPoint: Point = { x: 0, y: 0 }
  let activePointerId: number | null = null
  let timerHandle: unknown = null
  let lastEvent: PointerEventShim | null = null

  const clearTimer = (): void => {
    if (timerHandle !== null) {
      timer.clear(timerHandle)
      timerHandle = null
    }
  }

  const abort = (): void => {
    clearTimer()
    if (state === "tracking") opts.onCancel?.()
    state = "idle"
    activePointerId = null
  }

  const unsub: PointerUnsubscribe = source.bind(opts.target, {
    onStart(ev) {
      if (state === "cancelled" || activePointerId !== null) return
      activePointerId = ev.pointerId
      startPoint = { x: ev.clientX, y: ev.clientY }
      lastEvent = ev
      state = "tracking"
      timerHandle = timer.set(() => {
        timerHandle = null
        if (state !== "tracking" || lastEvent === null) return
        state = "active"
        opts.onPress?.({
          point: { x: lastEvent.clientX, y: lastEvent.clientY },
          duration: minDuration,
          pointerEvent: lastEvent,
        })
      }, minDuration)
    },
    onMove(ev) {
      if (state !== "tracking" || ev.pointerId !== activePointerId) return
      lastEvent = ev
      if (distance({ x: ev.clientX, y: ev.clientY }, startPoint) > maxMovement) {
        abort()
      }
    },
    onEnd(ev) {
      if (ev.pointerId !== activePointerId) return
      abort()
    },
    onCancel(ev) {
      if (ev.pointerId !== activePointerId) return
      abort()
    },
  })

  return {
    cancel() {
      if (state === "cancelled") return
      clearTimer()
      state = "cancelled"
      activePointerId = null
      unsub()
    },
    get state() {
      return state
    },
  }
}

// -----------------------------------------------------------------------
// Pan
// -----------------------------------------------------------------------

export type PanAxis = "x" | "y" | "both"

export interface PanEvent {
  readonly offset: Point
  readonly velocity: Point
  readonly pointerEvent: PointerEventShim
}

export interface PanOpts {
  readonly target: PointerBindTarget
  readonly source?: PointerSource
  readonly axis?: PanAxis
  /** Min total movement in px before onStart fires. Default 0. */
  readonly threshold?: number
  readonly onStart?: (ev: PanEvent) => void
  readonly onMove?: (ev: PanEvent) => void
  readonly onEnd?: (ev: PanEvent) => void
}

export interface PanHandle {
  cancel(): void
  readonly state: RecognizerState
  readonly offset: Point
  readonly velocity: Point
}

export function playPan(opts: PanOpts): PanHandle {
  const source = opts.source ?? createDomPointerSource()
  const axis: PanAxis = opts.axis ?? "both"
  const threshold = opts.threshold ?? 0

  const velocity = createVelocityTracker()
  let state: RecognizerState = "idle"
  let startPoint: Point = { x: 0, y: 0 }
  let offset: Point = { x: 0, y: 0 }
  let activePointerId: number | null = null
  let started = false

  const computeOffset = (ev: PointerEventShim): Point => {
    const dx = ev.clientX - startPoint.x
    const dy = ev.clientY - startPoint.y
    return {
      x: axis === "y" ? 0 : dx,
      y: axis === "x" ? 0 : dy,
    }
  }

  const unsub: PointerUnsubscribe = source.bind(opts.target, {
    onStart(ev) {
      if (state === "cancelled" || activePointerId !== null) return
      activePointerId = ev.pointerId
      startPoint = { x: ev.clientX, y: ev.clientY }
      offset = { x: 0, y: 0 }
      started = false
      velocity.reset()
      velocity.record({ x: ev.clientX, y: ev.clientY, time: ev.timeStamp })
      state = "tracking"
    },
    onMove(ev) {
      if (state === "cancelled" || ev.pointerId !== activePointerId) return
      if (state !== "tracking" && state !== "active") return
      const next = computeOffset(ev)
      offset = next
      velocity.record({ x: ev.clientX, y: ev.clientY, time: ev.timeStamp })
      if (!started) {
        if (Math.hypot(next.x, next.y) < threshold) return
        started = true
        state = "active"
        opts.onStart?.({ offset: next, velocity: velocity.velocity(), pointerEvent: ev })
      } else {
        opts.onMove?.({ offset: next, velocity: velocity.velocity(), pointerEvent: ev })
      }
    },
    onEnd(ev) {
      if (ev.pointerId !== activePointerId) return
      const v = velocity.velocity()
      if (started) {
        opts.onEnd?.({ offset, velocity: v, pointerEvent: ev })
      }
      state = "idle"
      started = false
      activePointerId = null
    },
    onCancel(ev) {
      if (ev.pointerId !== activePointerId) return
      state = "idle"
      started = false
      activePointerId = null
    },
  })

  return {
    cancel() {
      if (state === "cancelled") return
      state = "cancelled"
      activePointerId = null
      unsub()
    },
    get state() {
      return state
    },
    get offset() {
      return offset
    },
    get velocity() {
      return velocity.velocity()
    },
  }
}

// -----------------------------------------------------------------------
// Pinch (two-pointer)
// -----------------------------------------------------------------------

export interface PinchEvent {
  readonly scale: number
  readonly rotation: number
  readonly center: Point
  readonly pointerEvent: PointerEventShim
}

export interface PinchOpts {
  readonly target: PointerBindTarget
  readonly source?: PointerSource
  readonly onStart?: (ev: PinchEvent) => void
  readonly onChange?: (ev: PinchEvent) => void
  readonly onEnd?: (ev: PinchEvent) => void
}

export interface PinchHandle {
  cancel(): void
  readonly state: RecognizerState
  readonly scale: number
  readonly rotation: number
}

interface PointerSlot {
  id: number
  x: number
  y: number
}

function pinchGeometry(
  a: PointerSlot,
  b: PointerSlot,
): { dist: number; angle: number; center: Point } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return {
    dist: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  }
}

export function playPinch(opts: PinchOpts): PinchHandle {
  const source = opts.source ?? createDomPointerSource()

  let state: RecognizerState = "idle"
  const pointers = new Map<number, PointerSlot>()
  let initialDist = 0
  let initialAngle = 0
  let currentScale = 1
  let currentRotation = 0

  const activePair = (): [PointerSlot, PointerSlot] | null => {
    if (pointers.size < 2) return null
    const it = pointers.values()
    const a = it.next().value as PointerSlot
    const b = it.next().value as PointerSlot
    return [a, b]
  }

  const emitChange = (ev: PointerEventShim): void => {
    const pair = activePair()
    if (!pair) return
    const g = pinchGeometry(pair[0], pair[1])
    if (initialDist <= 0) return
    currentScale = g.dist / initialDist
    currentRotation = g.angle - initialAngle
    opts.onChange?.({
      scale: currentScale,
      rotation: currentRotation,
      center: g.center,
      pointerEvent: ev,
    })
  }

  const endPinch = (ev: PointerEventShim): void => {
    if (state !== "active") return
    state = "tracking"
    opts.onEnd?.({
      scale: currentScale,
      rotation: currentRotation,
      center: { x: ev.clientX, y: ev.clientY },
      pointerEvent: ev,
    })
  }

  const unsub: PointerUnsubscribe = source.bind(opts.target, {
    onStart(ev) {
      if (state === "cancelled") return
      pointers.set(ev.pointerId, { id: ev.pointerId, x: ev.clientX, y: ev.clientY })
      if (state === "idle") state = "tracking"
      if (state === "tracking" && pointers.size >= 2) {
        const pair = activePair()
        if (!pair) return
        const g = pinchGeometry(pair[0], pair[1])
        initialDist = g.dist
        initialAngle = g.angle
        currentScale = 1
        currentRotation = 0
        state = "active"
        opts.onStart?.({
          scale: 1,
          rotation: 0,
          center: g.center,
          pointerEvent: ev,
        })
      }
    },
    onMove(ev) {
      if (state === "cancelled") return
      const slot = pointers.get(ev.pointerId)
      if (!slot) return
      slot.x = ev.clientX
      slot.y = ev.clientY
      if (state === "active") emitChange(ev)
    },
    onEnd(ev) {
      const had = pointers.delete(ev.pointerId)
      if (!had) return
      if (state === "active" && pointers.size < 2) endPinch(ev)
      if (pointers.size === 0) state = "idle"
    },
    onCancel(ev) {
      const had = pointers.delete(ev.pointerId)
      if (!had) return
      if (state === "active" && pointers.size < 2) endPinch(ev)
      if (pointers.size === 0) state = "idle"
    },
  })

  return {
    cancel() {
      if (state === "cancelled") return
      state = "cancelled"
      pointers.clear()
      unsub()
    },
    get state() {
      return state
    },
    get scale() {
      return currentScale
    },
    get rotation() {
      return currentRotation
    },
  }
}
