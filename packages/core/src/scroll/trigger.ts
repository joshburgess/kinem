/**
 * Scroll trigger geometry. Parses GSAP-style position strings such as
 * `"top 80%"` into a pair of fractions:
 *
 *   - `element`: 0 = top of trigger element, 1 = bottom
 *   - `viewport`: 0 = top of viewport, 1 = bottom
 *
 * A trigger fires when the element-relative point and the viewport-
 * relative point vertically align. Given `scrollY` plus element
 * geometry, `computeBounds` returns the scrollY values at which the
 * `start` and `end` positions activate, and `progressAt` normalizes a
 * scrollY into [0, 1] between them.
 *
 * The module is pure and DOM-free; the DOM read happens in
 * `ScrollSource.getRect()`.
 */

export interface TriggerPos {
  readonly element: number
  readonly viewport: number
}

function parseRef(raw: string): number {
  const t = raw.trim().toLowerCase()
  if (t === "top") return 0
  if (t === "center") return 0.5
  if (t === "bottom") return 1
  const pct = /^(-?\d+(?:\.\d+)?)%$/.exec(t)
  if (pct) return Number(pct[1]) / 100
  const n = Number(t)
  if (Number.isFinite(n)) return n
  throw new Error(`scroll: invalid trigger reference "${raw}"`)
}

/** Parse a GSAP-style `"<element> <viewport>"` position string. */
export function parseTriggerPos(input: string | TriggerPos): TriggerPos {
  if (typeof input !== "string") return input
  const parts = input.trim().split(/\s+/)
  if (parts.length !== 2) {
    throw new Error(`scroll: trigger position must be "<element> <viewport>" (got "${input}")`)
  }
  const [eRef, vRef] = parts as [string, string]
  return { element: parseRef(eRef), viewport: parseRef(vRef) }
}

export interface TriggerGeom {
  /** Element's top in document coordinates (viewport top + scrollY). */
  readonly elementTop: number
  readonly elementHeight: number
  readonly viewportHeight: number
}

export interface ScrollBounds {
  readonly scrollStart: number
  readonly scrollEnd: number
}

/** Compute the scrollY thresholds at which `start` and `end` activate. */
export function computeBounds(start: TriggerPos, end: TriggerPos, geom: TriggerGeom): ScrollBounds {
  return {
    scrollStart:
      geom.elementTop + start.element * geom.elementHeight - start.viewport * geom.viewportHeight,
    scrollEnd:
      geom.elementTop + end.element * geom.elementHeight - end.viewport * geom.viewportHeight,
  }
}

/** Progress in [0, 1] given the current scroll position and bounds. */
export function progressAt(scrollY: number, bounds: ScrollBounds): number {
  const span = bounds.scrollEnd - bounds.scrollStart
  if (span === 0) return scrollY >= bounds.scrollStart ? 1 : 0
  const p = (scrollY - bounds.scrollStart) / span
  return p < 0 ? 0 : p > 1 ? 1 : p
}

export type ScrollZone = "before" | "active" | "after"

/** Classify a scroll position relative to the trigger zone. */
export function zoneAt(scrollY: number, bounds: ScrollBounds): ScrollZone {
  const lo = Math.min(bounds.scrollStart, bounds.scrollEnd)
  const hi = Math.max(bounds.scrollStart, bounds.scrollEnd)
  if (scrollY < lo) return "before"
  if (scrollY > hi) return "after"
  return "active"
}
