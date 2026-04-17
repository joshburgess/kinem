import { describe, expect, it } from "vitest"
import { UnitMismatchError, interpolateUnit, parseUnit } from "./units"

describe("parseUnit", () => {
  it("parses common CSS lengths", () => {
    expect(parseUnit("100px")).toEqual({ value: 100, unit: "px" })
    expect(parseUnit("-1.5rem")).toEqual({ value: -1.5, unit: "rem" })
    expect(parseUnit("50%")).toEqual({ value: 50, unit: "%" })
    expect(parseUnit("0.25vw")).toEqual({ value: 0.25, unit: "vw" })
  })

  it("parses unitless numbers", () => {
    expect(parseUnit("0")).toEqual({ value: 0, unit: "" })
    expect(parseUnit("42")).toEqual({ value: 42, unit: "" })
  })

  it("handles scientific notation", () => {
    expect(parseUnit("1e2px")).toEqual({ value: 100, unit: "px" })
    expect(parseUnit("-1.5e-1")).toEqual({ value: -0.15, unit: "" })
  })

  it("returns null for invalid input", () => {
    expect(parseUnit("")).toBeNull()
    expect(parseUnit("auto")).toBeNull()
    expect(parseUnit("10px 20px")).toBeNull()
  })
})

describe("interpolateUnit", () => {
  it("interpolates between matching units", () => {
    const fn = interpolateUnit("0px", "100px")
    expect(fn(0)).toBe("0px")
    expect(fn(1)).toBe("100px")
    expect(fn(0.5)).toBe("50px")
  })

  it("interpolates percentages", () => {
    const fn = interpolateUnit("0%", "50%")
    expect(fn(0.5)).toBe("25%")
  })

  it("promotes zero-unitless to the other side's unit", () => {
    const fn = interpolateUnit("0", "200px")
    expect(fn(0.5)).toBe("100px")
    const fn2 = interpolateUnit("50%", "0")
    expect(fn2(1)).toBe("0%")
  })

  it("throws UnitMismatchError for incompatible units", () => {
    expect(() => interpolateUnit("10px", "50%")).toThrow(UnitMismatchError)
  })

  it("throws on unparseable input", () => {
    expect(() => interpolateUnit("auto", "10px")).toThrow()
  })
})
