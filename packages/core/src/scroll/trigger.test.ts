import { describe, expect, it } from "vitest"
import { computeBounds, parseTriggerPos, progressAt, zoneAt } from "./trigger"

describe("parseTriggerPos", () => {
  it("parses keyword references", () => {
    expect(parseTriggerPos("top top")).toEqual({ element: 0, viewport: 0 })
    expect(parseTriggerPos("center center")).toEqual({ element: 0.5, viewport: 0.5 })
    expect(parseTriggerPos("bottom bottom")).toEqual({ element: 1, viewport: 1 })
  })

  it("parses percentages", () => {
    expect(parseTriggerPos("top 80%")).toEqual({ element: 0, viewport: 0.8 })
    expect(parseTriggerPos("50% 20%")).toEqual({ element: 0.5, viewport: 0.2 })
  })

  it("parses mixed keyword + percent", () => {
    expect(parseTriggerPos("bottom 20%")).toEqual({ element: 1, viewport: 0.2 })
  })

  it("passes through object input unchanged", () => {
    const p = { element: 0.1, viewport: 0.9 }
    expect(parseTriggerPos(p)).toBe(p)
  })

  it("throws on malformed input", () => {
    expect(() => parseTriggerPos("top")).toThrow(/must be "<element> <viewport>"/)
    expect(() => parseTriggerPos("nonsense top")).toThrow(/invalid trigger reference/)
  })
})

describe("computeBounds", () => {
  it("maps 'top 80%' / 'bottom 20%' for a 400x600 viewport", () => {
    const start = parseTriggerPos("top 80%")
    const end = parseTriggerPos("bottom 20%")
    const geom = { elementTop: 1000, elementHeight: 400, viewportHeight: 600 }
    const b = computeBounds(start, end, geom)
    // start: 1000 + 0*400 - 0.8*600 = 520
    expect(b.scrollStart).toBe(520)
    // end:   1000 + 1*400 - 0.2*600 = 1280
    expect(b.scrollEnd).toBe(1280)
  })
})

describe("progressAt", () => {
  const b = { scrollStart: 100, scrollEnd: 300 }
  it("returns 0 before the zone", () => {
    expect(progressAt(0, b)).toBe(0)
    expect(progressAt(100, b)).toBe(0)
  })
  it("returns 1 after the zone", () => {
    expect(progressAt(300, b)).toBe(1)
    expect(progressAt(999, b)).toBe(1)
  })
  it("interpolates linearly inside the zone", () => {
    expect(progressAt(200, b)).toBe(0.5)
    expect(progressAt(150, b)).toBe(0.25)
  })
  it("handles zero-width bounds (instant snap)", () => {
    const z = { scrollStart: 500, scrollEnd: 500 }
    expect(progressAt(499, z)).toBe(0)
    expect(progressAt(500, z)).toBe(1)
    expect(progressAt(501, z)).toBe(1)
  })
})

describe("zoneAt", () => {
  const b = { scrollStart: 100, scrollEnd: 300 }
  it("classifies before / active / after", () => {
    expect(zoneAt(50, b)).toBe("before")
    expect(zoneAt(100, b)).toBe("active")
    expect(zoneAt(200, b)).toBe("active")
    expect(zoneAt(300, b)).toBe("active")
    expect(zoneAt(301, b)).toBe("after")
  })

  it("handles reversed bounds (scrollEnd < scrollStart)", () => {
    const rev = { scrollStart: 300, scrollEnd: 100 }
    expect(zoneAt(50, rev)).toBe("before")
    expect(zoneAt(200, rev)).toBe("active")
    expect(zoneAt(400, rev)).toBe("after")
  })
})
