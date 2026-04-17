import { describe, expect, it } from "vitest"
import { interpolateTransform, parseTransform } from "./transform"

describe("parseTransform", () => {
  it("parses single functions", () => {
    expect(parseTransform("translateX(10px)")).toEqual([{ name: "translatex", args: ["10px"] }])
  })

  it("parses multiple functions", () => {
    const parsed = parseTransform("translate(10px, 20px) rotate(45deg) scale(1.5)")
    expect(parsed).toHaveLength(3)
    expect(parsed[0]).toEqual({ name: "translate", args: ["10px", "20px"] })
    expect(parsed[1]).toEqual({ name: "rotate", args: ["45deg"] })
    expect(parsed[2]).toEqual({ name: "scale", args: ["1.5"] })
  })

  it("handles whitespace variations", () => {
    const parsed = parseTransform("  translate( 10px , 20px )   rotate(45deg)")
    expect(parsed).toHaveLength(2)
  })

  it("returns empty list for `none` or empty string", () => {
    expect(parseTransform("none")).toEqual([])
    expect(parseTransform("")).toEqual([])
  })
})

describe("interpolateTransform", () => {
  it("interpolates a single translate", () => {
    const fn = interpolateTransform("translateX(0px)", "translateX(100px)")
    expect(fn(0)).toBe("translatex(0px)")
    expect(fn(0.5)).toBe("translatex(50px)")
    expect(fn(1)).toBe("translatex(100px)")
  })

  it("interpolates multiple functions independently", () => {
    const fn = interpolateTransform(
      "translate(0px, 0px) rotate(0deg) scale(1)",
      "translate(100px, 50px) rotate(90deg) scale(2)",
    )
    expect(fn(0.5)).toBe("translate(50px, 25px) rotate(45deg) scale(1.5)")
  })

  it("rotates via shortest arc: 350deg -> 10deg goes through 0, not 180", () => {
    const fn = interpolateTransform("rotate(350deg)", "rotate(10deg)")
    // Shortest arc: 350 -> 360 -> 370 (equivalent to 10). Midpoint should be 360deg (or 0).
    const mid = fn(0.5)
    const m = /rotate\(([-\d.]+)deg\)/.exec(mid)
    expect(m).not.toBeNull()
    const d = Number.parseFloat(m?.[1] ?? "0")
    // Accept 0 or 360 or within a degree of either.
    const norm = ((d % 360) + 360) % 360
    expect(Math.min(norm, 360 - norm)).toBeLessThan(1)
  })

  it("handles rotate with different angle units (rad)", () => {
    const fn = interpolateTransform("rotate(0rad)", `rotate(${Math.PI}rad)`)
    const mid = fn(0.5)
    const m = /rotate\(([-\d.]+)rad\)/.exec(mid)
    expect(m).not.toBeNull()
    expect(Number.parseFloat(m?.[1] ?? "0")).toBeCloseTo(Math.PI / 2, 3)
  })

  it("interpolates scale", () => {
    const fn = interpolateTransform("scale(1)", "scale(2)")
    expect(fn(0.5)).toBe("scale(1.5)")
  })

  it("throws on structure mismatch (different function counts)", () => {
    expect(() => interpolateTransform("translate(0px)", "translate(0px) rotate(0deg)")).toThrow()
  })

  it("throws on function name mismatch", () => {
    expect(() => interpolateTransform("translateX(0px)", "translateY(0px)")).toThrow()
  })
})
