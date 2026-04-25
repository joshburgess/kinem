import { describe, expect, it } from "vitest"
import { easeOut, linear } from "../core/easing"
import { bezierPath } from "./bezier-path"

describe("bezierPath", () => {
  it("endpoints match the first and last control points exactly", () => {
    const b = bezierPath([
      [0, 0],
      [50, -100],
      [150, -100],
      [200, 0],
    ])
    expect(b.interpolate(0).x).toBe(0)
    expect(b.interpolate(0).y).toBe(0)
    expect(b.interpolate(1).x).toBe(200)
    expect(b.interpolate(1).y).toBe(0)
  })

  it("traces a straight line for two points (linear)", () => {
    const b = bezierPath([
      [0, 0],
      [100, 0],
    ])
    expect(b.interpolate(0.25).x).toBeCloseTo(25, 5)
    expect(b.interpolate(0.5).x).toBeCloseTo(50, 5)
    expect(b.interpolate(0.75).x).toBeCloseTo(75, 5)
  })

  it("midpoint of a symmetric quadratic peaks at the control point's y", () => {
    const b = bezierPath([
      [0, 0],
      [50, 100],
      [100, 0],
    ])
    const mid = b.interpolate(0.5)
    expect(mid.x).toBeCloseTo(50, 1)
    // Quadratic midpoint y = (P0 + 2*C + P2)/4 = (0 + 200 + 0)/4 = 50
    expect(mid.y).toBeCloseTo(50, 1)
  })

  it("chains cubic segments via the 1+3N convention", () => {
    const b = bezierPath([
      [0, 0],
      [33, 0],
      [66, 0],
      [100, 0],
      [133, 0],
      [166, 0],
      [200, 0],
    ])
    // Two flat cubic segments forming a straight line; arc-length param
    // makes progress proportional to distance.
    expect(b.interpolate(0.5).x).toBeCloseTo(100, 0)
  })

  it("rejects point counts that don't match 2/3/4 or 1+3N", () => {
    expect(() =>
      bezierPath([
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ]),
    ).toThrow(/1\+3N/)
  })

  it("rejects fewer than two points", () => {
    expect(() => bezierPath([[0, 0]])).toThrow(/at least 2 points/)
  })

  it("uses the supplied duration and easing", () => {
    const b = bezierPath(
      [
        [0, 0],
        [100, 0],
      ],
      { duration: 1234, easing: easeOut },
    )
    expect(b.duration).toBe(1234)
    expect(b.easing).toBe(easeOut)
  })

  it("defaults to linear easing and 400ms duration", () => {
    const b = bezierPath([
      [0, 0],
      [100, 0],
    ])
    expect(b.duration).toBe(400)
    expect(b.easing).toBe(linear)
  })

  it("emits a tangent rotate when rotateAlongPath is enabled", () => {
    const b = bezierPath(
      [
        [0, 0],
        [100, 0],
      ],
      { rotateAlongPath: true },
    )
    const v = b.interpolate(0.5)
    expect(v.rotate).toBeCloseTo(0, 5)
    expect(b.properties).toContain("rotate")
  })

  it("rotate matches a 90-degree turn at the start of an upward quadratic", () => {
    const b = bezierPath(
      [
        [0, 0],
        [0, -100],
        [100, -100],
      ],
      { rotateAlongPath: true },
    )
    // Tangent at t=0 of P0,C,P1 is 2*(C - P0); here that is (0,-200)
    // which is straight up -> -90 degrees
    const start = b.interpolate(0)
    expect(start.rotate).toBeCloseTo(-90, 1)
  })

  it("arc-length parameterization moves at near-constant speed on a flat line", () => {
    const b = bezierPath([
      [0, 0],
      [100, 0],
    ])
    expect(b.interpolate(0.25).x).toBeCloseTo(25, 1)
    expect(b.interpolate(0.5).x).toBeCloseTo(50, 1)
    expect(b.interpolate(0.75).x).toBeCloseTo(75, 1)
  })

  it("exposes the property keys it produces", () => {
    const a = bezierPath([
      [0, 0],
      [1, 1],
    ])
    expect(a.properties).toEqual(["x", "y"])
    const b = bezierPath(
      [
        [0, 0],
        [1, 1],
      ],
      { rotateAlongPath: true },
    )
    expect(b.properties).toEqual(["x", "y", "rotate"])
  })
})
