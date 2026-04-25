import { describe, expect, it } from "vitest"
import { inertia } from "./inertia"

describe("inertia", () => {
  it("starts at the supplied 'from' values when progress = 0", () => {
    const def = inertia({ x: [10, 800], y: [-5, -400] })
    const v = def.interpolate(0)
    expect(v.x).toBeCloseTo(10, 9)
    expect(v.y).toBeCloseTo(-5, 9)
  })

  it("approaches from + power * v0 * (tc/1000) as progress → 1", () => {
    const def = inertia({ x: [0, 1000] }, { timeConstant: 325, power: 0.8, restDelta: 0.5 })
    const v = def.interpolate(1)
    // Total displacement = 0.8 * 1000 * 0.325 = 260
    // At duration t = tc * ln(260/0.5) ≈ 325 * ln(520) ≈ 2032 ms
    // value(duration) = 260 * (1 - exp(-t/tc)) = 260 * (1 - 0.5/260) = 260 - 0.5 = 259.5
    expect(v.x).toBeCloseTo(259.5, 1)
  })

  it("duration scales with timeConstant", () => {
    const a = inertia({ x: [0, 1000] }, { timeConstant: 100 })
    const b = inertia({ x: [0, 1000] }, { timeConstant: 400 })
    expect(b.duration).toBeGreaterThan(a.duration)
    // duration = tc * ln(power*v*tc / (1000*restDelta)). Varying only tc by 4x:
    // ratio = 4 * ln(320/0.5) / ln(80/0.5) ≈ 5.09 (super-linear because the
    // displacement itself scales with tc, lengthening the log term).
    expect(b.duration / a.duration).toBeCloseTo(5.09, 1)
  })

  it("zero velocity yields duration 0 and stays at 'from'", () => {
    const def = inertia({ x: [42, 0] })
    expect(def.duration).toBe(0)
    expect(def.interpolate(0).x).toBe(42)
    expect(def.interpolate(1).x).toBe(42)
  })

  it("bounds clamp the output without re-shaping the trajectory", () => {
    const def = inertia({ x: [0, 2000] }, { bounds: { x: [0, 50] } })
    // Total displacement would be 0.8 * 2000 * 0.325 = 520, well past the bound of 50.
    expect(def.interpolate(1).x).toBe(50)
    // Mid-progress should also clamp once we exceed 50.
    expect(def.interpolate(0.5).x).toBeLessThanOrEqual(50)
  })

  it("monotonically increases for positive velocity", () => {
    const def = inertia({ x: [0, 1000] })
    let prev = def.interpolate(0).x
    for (let i = 1; i <= 20; i++) {
      const v = def.interpolate(i / 20).x
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it("multi-property duration is the max across properties", () => {
    const def = inertia({
      x: [0, 100], // small velocity → small duration
      y: [0, 5000], // big velocity → larger duration
    })
    const x = inertia({ x: [0, 100] })
    const y = inertia({ y: [0, 5000] })
    expect(def.duration).toBe(Math.max(x.duration, y.duration))
  })

  it("properties metadata reflects the input keys", () => {
    const def = inertia({ translateX: [0, 100], translateY: [0, -200] })
    expect(def.properties).toEqual(["translateX", "translateY"])
  })

  it("rejects non-positive timeConstant", () => {
    expect(() => inertia({ x: [0, 100] }, { timeConstant: 0 })).toThrow(/timeConstant/)
    expect(() => inertia({ x: [0, 100] }, { timeConstant: -10 })).toThrow(/timeConstant/)
  })

  it("rejects non-positive restDelta", () => {
    expect(() => inertia({ x: [0, 100] }, { restDelta: 0 })).toThrow(/restDelta/)
  })
})
