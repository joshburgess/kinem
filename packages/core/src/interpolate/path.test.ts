import { describe, expect, it } from "vitest"
import { interpolatePath, parsePath } from "./path"

describe("parsePath", () => {
  it("parses simple commands", () => {
    expect(parsePath("M 10 20 L 30 40")).toEqual([
      { type: "M", params: [10, 20] },
      { type: "L", params: [30, 40] },
    ])
  })

  it("splits implicit command repeats", () => {
    // "M 0 0 L 10 10 20 20" -> M (0,0), L (10,10), L (20,20)
    const parsed = parsePath("M 0 0 L 10 10 20 20")
    expect(parsed).toHaveLength(3)
    expect(parsed[1]).toEqual({ type: "L", params: [10, 10] })
    expect(parsed[2]).toEqual({ type: "L", params: [20, 20] })
  })

  it("handles Z close", () => {
    const parsed = parsePath("M 0 0 L 10 0 Z")
    expect(parsed[parsed.length - 1]).toEqual({ type: "Z", params: [] })
  })

  it("handles comma separators", () => {
    const parsed = parsePath("M10,20 L30,40")
    expect(parsed).toHaveLength(2)
    expect(parsed[1]).toEqual({ type: "L", params: [30, 40] })
  })

  it("handles cubic bezier", () => {
    const parsed = parsePath("M 0 0 C 10 10 20 20 30 30")
    expect(parsed).toHaveLength(2)
    expect(parsed[1]).toEqual({ type: "C", params: [10, 10, 20, 20, 30, 30] })
  })

  it("returns empty list for empty input", () => {
    expect(parsePath("")).toEqual([])
  })
})

describe("interpolatePath", () => {
  it("interpolates matching linear paths", () => {
    const fn = interpolatePath("M 0 0 L 10 0", "M 0 0 L 20 10")
    expect(fn(0)).toBe("M0 0 L10 0")
    expect(fn(1)).toBe("M0 0 L20 10")
    expect(fn(0.5)).toBe("M0 0 L15 5")
  })

  it("interpolates a cubic bezier command", () => {
    const fn = interpolatePath("M 0 0 C 0 10 10 10 10 0", "M 0 0 C 0 20 10 20 10 0")
    expect(fn(0.5)).toBe("M0 0 C0 15 10 15 10 0")
  })

  it("throws on structure mismatch (different command counts)", () => {
    expect(() => interpolatePath("M 0 0 L 10 10", "M 0 0 L 10 10 L 20 20")).toThrow(
      /structure mismatch/,
    )
  })

  it("throws on command-type mismatch at same position", () => {
    expect(() => interpolatePath("M 0 0 L 10 10", "M 0 0 H 10")).toThrow(/command mismatch/)
  })

  it("preserves Z commands through interpolation", () => {
    const fn = interpolatePath("M 0 0 L 10 0 Z", "M 0 0 L 20 0 Z")
    expect(fn(1).endsWith("Z")).toBe(true)
  })
})
