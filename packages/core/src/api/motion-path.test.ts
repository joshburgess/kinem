import { describe, expect, it } from "vitest"
import { motionPath, svgPathToCubicPoints } from "./motion-path"

describe("svgPathToCubicPoints", () => {
  it("converts a simple line to cubic control points", () => {
    const pts = svgPathToCubicPoints("M 0 0 L 100 0")
    // M emits one anchor; L emits 3 (two interpolated controls + endpoint)
    expect(pts).toHaveLength(4)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[3]).toEqual([100, 0])
    // Line-to-cubic controls land at 1/3 and 2/3 along the segment
    expect(pts[1]?.[0]).toBeCloseTo(100 / 3, 5)
    expect(pts[2]?.[0]).toBeCloseTo(200 / 3, 5)
  })

  it("preserves explicit cubic control points (C)", () => {
    const pts = svgPathToCubicPoints("M 0 0 C 50 -100 150 -100 200 0")
    expect(pts).toHaveLength(4)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[1]).toEqual([50, -100])
    expect(pts[2]).toEqual([150, -100])
    expect(pts[3]).toEqual([200, 0])
  })

  it("converts a quadratic (Q) to a cubic", () => {
    // Q midpoint y at t=0.5 = 0.25*0 + 0.5*100 + 0.25*0 = 50
    const pts = svgPathToCubicPoints("M 0 0 Q 50 100 100 0")
    expect(pts).toHaveLength(4)
    expect(pts[0]).toEqual([0, 0])
    // Cubic-form controls: P0 + 2/3*(Q-P0), P1 + 2/3*(Q-P1)
    expect(pts[1]?.[0]).toBeCloseTo(100 / 3, 5)
    expect(pts[1]?.[1]).toBeCloseTo(200 / 3, 5)
    expect(pts[2]?.[0]).toBeCloseTo(200 / 3, 5)
    expect(pts[2]?.[1]).toBeCloseTo(200 / 3, 5)
    expect(pts[3]).toEqual([100, 0])
  })

  it("reflects S smooth-cubic control points off the previous C", () => {
    const pts = svgPathToCubicPoints("M 0 0 C 50 -100 150 -100 200 0 S 350 100 400 0")
    // After the C: prev-control = (150, -100), endpoint = (200, 0)
    // Reflection: (2*200 - 150, 2*0 - (-100)) = (250, 100)
    expect(pts).toHaveLength(7)
    expect(pts[4]).toEqual([250, 100])
    expect(pts[5]).toEqual([350, 100])
    expect(pts[6]).toEqual([400, 0])
  })

  it("handles relative commands", () => {
    const abs = svgPathToCubicPoints("M 10 10 L 110 10")
    const rel = svgPathToCubicPoints("M 10 10 l 100 0")
    expect(rel).toEqual(abs)
  })

  it("closes the path with Z", () => {
    const pts = svgPathToCubicPoints("M 0 0 L 100 0 L 100 100 Z")
    // M(1) + L(3) + L(3) + Z(3) = 10 points
    expect(pts).toHaveLength(10)
    expect(pts[pts.length - 1]).toEqual([0, 0])
  })

  it("rejects multi-subpath strings", () => {
    expect(() => svgPathToCubicPoints("M 0 0 L 10 0 M 50 50 L 60 50")).toThrow(/subpath/)
  })

  it("rejects arc commands", () => {
    expect(() => svgPathToCubicPoints("M 0 0 A 50 50 0 0 1 100 0")).toThrow(/arc/)
  })
})

describe("motionPath", () => {
  it("endpoints match the path start and end", () => {
    const m = motionPath("M 0 0 C 50 -100 150 -100 200 0")
    expect(m.interpolate(0).x).toBe(0)
    expect(m.interpolate(0).y).toBe(0)
    expect(m.interpolate(1).x).toBe(200)
    expect(m.interpolate(1).y).toBe(0)
  })

  it("respects rotateAlongPath", () => {
    const m = motionPath("M 0 0 L 100 0", { rotateAlongPath: true })
    expect(m.interpolate(0.5).rotate).toBeCloseTo(0, 5)
    expect(m.properties).toContain("rotate")
  })

  it("threads through duration and easing options", () => {
    const m = motionPath("M 0 0 L 100 0", { duration: 800 })
    expect(m.duration).toBe(800)
  })

  it("interpolates through a multi-segment chained path", () => {
    const m = motionPath("M 0 0 C 50 -100 150 -100 200 0 C 250 100 350 100 400 0")
    // Endpoints exact
    expect(m.interpolate(0).x).toBe(0)
    expect(m.interpolate(1).x).toBe(400)
    // Middle of the joined path should be near the shared anchor (200, 0)
    const mid = m.interpolate(0.5)
    expect(mid.x).toBeCloseTo(200, 0)
    expect(Math.abs(mid.y)).toBeLessThan(1)
  })
})
