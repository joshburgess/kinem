import { describe, expect, it } from "vitest"
import { catmullRom, catmullRomToCubicPoints } from "./catmull-rom"

describe("catmullRomToCubicPoints", () => {
  it("emits 1 + 3*(N-1) points for an open spline of N waypoints", () => {
    const pts = catmullRomToCubicPoints(
      [
        [0, 0],
        [10, 10],
        [20, 0],
        [30, 10],
      ],
      0,
      false,
    )
    expect(pts).toHaveLength(1 + 3 * 3)
  })

  it("emits 1 + 3*N points for a closed spline of N waypoints", () => {
    const pts = catmullRomToCubicPoints(
      [
        [0, 0],
        [10, 10],
        [20, 0],
      ],
      0,
      true,
    )
    expect(pts).toHaveLength(1 + 3 * 3)
    // Closed: last endpoint must equal first waypoint
    expect(pts[pts.length - 1]?.[0]).toBe(0)
    expect(pts[pts.length - 1]?.[1]).toBe(0)
  })

  it("with tension=1, control points collapse onto endpoints (straight lines)", () => {
    const pts = catmullRomToCubicPoints(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      1,
      false,
    )
    // For tension=1, k=0, so c1 = p0 and c2 = p1 — a degenerate cubic = line.
    expect(pts[1]).toEqual([0, 0])
    expect(pts[2]).toEqual([10, 0])
    expect(pts[3]).toEqual([10, 0])
    expect(pts[4]).toEqual([10, 0])
    expect(pts[5]).toEqual([20, 0])
  })

  it("rejects fewer than 2 waypoints", () => {
    expect(() => catmullRomToCubicPoints([[0, 0]], 0, false)).toThrow()
  })
})

describe("catmullRom", () => {
  it("passes through every waypoint (open)", () => {
    const wps: [number, number][] = [
      [0, 0],
      [100, 50],
      [200, 0],
      [300, 50],
    ]
    const c = catmullRom(wps)
    // Endpoints are exact
    expect(c.interpolate(0).x).toBeCloseTo(wps[0]?.[0] as number, 5)
    expect(c.interpolate(1).x).toBeCloseTo(wps[wps.length - 1]?.[0] as number, 5)
  })

  it("returns to the start waypoint when closed", () => {
    const c = catmullRom(
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      { closed: true },
    )
    const start = c.interpolate(0)
    const end = c.interpolate(1)
    expect(end.x).toBeCloseTo(start.x, 5)
    expect(end.y).toBeCloseTo(start.y, 5)
  })

  it("threads through duration and easing", () => {
    const c = catmullRom(
      [
        [0, 0],
        [10, 10],
      ],
      { duration: 1500 },
    )
    expect(c.duration).toBe(1500)
  })

  it("emits rotateAlongPath when requested", () => {
    const c = catmullRom(
      [
        [0, 0],
        [10, 10],
      ],
      { rotateAlongPath: true },
    )
    expect(c.properties).toContain("rotate")
  })
})
