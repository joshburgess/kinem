import { describe, expect, it } from "vitest"
import { keyframes } from "./keyframes"

describe("keyframes", () => {
  it("endpoints hit the first and last stop exactly", () => {
    const k = keyframes({ y: [0, 50, 0] }, { duration: 600 })
    expect(k.interpolate(0).y).toBe(0)
    expect(k.interpolate(1).y).toBe(0)
  })

  it("even distribution interpolates piecewise between stops", () => {
    // stops at 0, 0.5, 1 -> midpoint of segment 0 (p=0.25) is 25
    const k = keyframes({ y: [0, 50, 0] })
    expect(k.interpolate(0.25).y).toBe(25)
    expect(k.interpolate(0.5).y).toBe(50)
    expect(k.interpolate(0.75).y).toBe(25)
  })

  it("handles multiple properties with independent stops", () => {
    const k = keyframes({
      y: [0, -50, 0, -25, 0],
      scale: [1, 1.1, 1, 1.05, 1],
    })
    const mid = k.interpolate(0.5)
    expect(mid.y).toBe(0)
    expect(mid.scale).toBe(1)
  })

  it("accepts explicit offsets", () => {
    const k = keyframes({ y: [0, 100, 0] }, { offsets: [0, 0.25, 1] })
    expect(k.interpolate(0.25).y).toBe(100)
    // second segment spans [0.25, 1]; local p at p=0.625 = 0.5 -> 50
    expect(k.interpolate(0.625).y).toBe(50)
  })

  it("rejects a property with fewer than two stops", () => {
    expect(() => keyframes({ y: [0] })).toThrow()
  })

  it("rejects offsets of the wrong length", () => {
    expect(() => keyframes({ y: [0, 1, 2] }, { offsets: [0, 1] })).toThrow()
  })

  it("rejects non-monotonic offsets", () => {
    expect(() => keyframes({ y: [0, 1, 2] }, { offsets: [0, 0.8, 0.5] })).toThrow()
  })

  it("interpolates string-valued properties via the registry", () => {
    const k = keyframes({ color: ["#000000", "#ff0000", "#ffffff"] })
    const mid = k.interpolate(0.5).color
    expect(mid.startsWith("#")).toBe(true)
  })
})
