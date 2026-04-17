import { describe, expect, it } from "vitest"
import { interpolateNumber } from "./number"

describe("interpolateNumber", () => {
  it("hits endpoints exactly", () => {
    const fn = interpolateNumber(0, 100)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(100)
  })

  it("blends linearly through the midpoint", () => {
    const fn = interpolateNumber(0, 100)
    expect(fn(0.5)).toBe(50)
    expect(fn(0.25)).toBe(25)
  })

  it("extrapolates outside [0, 1]", () => {
    const fn = interpolateNumber(0, 100)
    expect(fn(-0.5)).toBe(-50)
    expect(fn(1.5)).toBe(150)
  })

  it("handles negative and fractional ranges", () => {
    const fn = interpolateNumber(-2.5, 2.5)
    expect(fn(0.5)).toBe(0)
  })
})
