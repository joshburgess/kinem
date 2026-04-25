import { describe, expect, it } from "vitest"
import { arc } from "./arc"

describe("arc", () => {
  it("starts at the from-angle and ends at the to-angle", () => {
    // 0° -> 90° quarter circle around (0,0) radius 100
    const a = arc(0, 0, 100, 0, 90)
    const start = a.interpolate(0)
    const end = a.interpolate(1)
    expect(start.x).toBeCloseTo(100, 5)
    expect(start.y).toBeCloseTo(0, 5)
    expect(end.x).toBeCloseTo(0, 5)
    expect(end.y).toBeCloseTo(100, 5)
  })

  it("midpoint of a 0->180 sweep lands on the perpendicular axis", () => {
    const a = arc(0, 0, 50, 0, 180)
    const mid = a.interpolate(0.5)
    expect(mid.x).toBeCloseTo(0, 5)
    expect(mid.y).toBeCloseTo(50, 5)
  })

  it("traces an exact circle (no Bezier approximation error)", () => {
    const a = arc(0, 0, 73, 0, 360)
    for (let i = 0; i <= 16; i++) {
      const v = a.interpolate(i / 16)
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(73, 9)
    }
  })

  it("emits a rotate when rotateAlongPath is enabled", () => {
    const a = arc(0, 0, 10, 0, 360, { rotateAlongPath: true })
    expect(a.properties).toContain("rotate")
    expect(typeof a.interpolate(0.5).rotate).toBe("number")
  })

  it("supports negative sweeps (CW)", () => {
    const a = arc(0, 0, 10, 0, -90)
    const end = a.interpolate(1)
    expect(end.x).toBeCloseTo(0, 5)
    expect(end.y).toBeCloseTo(-10, 5)
  })
})
