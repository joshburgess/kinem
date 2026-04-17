import { describe, expect, it } from "vitest"
import { findInterpolator, interpolate, registerInterpolator } from "./registry"

describe("registry", () => {
  it("dispatches numbers", () => {
    expect(findInterpolator(42)?.name).toBe("number")
    const fn = interpolate(0, 100)
    expect(fn(0.5)).toBe(50)
  })

  it("dispatches colors", () => {
    expect(findInterpolator("#fff")?.name).toBe("color")
    expect(findInterpolator("rgb(0 0 0)")?.name).toBe("color")
    expect(findInterpolator("oklch(0.5 0 0)")?.name).toBe("color")

    const fn = interpolate("#000000", "#ffffff")
    expect(fn(0)).toBe("#000000")
    expect(fn(1)).toBe("#ffffff")
  })

  it("dispatches transform strings", () => {
    expect(findInterpolator("translateX(10px)")?.name).toBe("transform")
    expect(findInterpolator("rotate(45deg) scale(2)")?.name).toBe("transform")

    const fn = interpolate("translateX(0px)", "translateX(100px)")
    expect(fn(0.5)).toBe("translatex(50px)")
  })

  it("dispatches SVG paths", () => {
    expect(findInterpolator("M 0 0 L 10 10")?.name).toBe("path")

    const fn = interpolate("M 0 0 L 10 0", "M 0 0 L 20 0")
    expect(fn(0.5)).toBe("M0 0 L15 0")
  })

  it("dispatches CSS units", () => {
    expect(findInterpolator("100px")?.name).toBe("unit")
    expect(findInterpolator("50%")?.name).toBe("unit")

    const fn = interpolate("0px", "100px")
    expect(fn(0.5)).toBe("50px")
  })

  it("prefers transform over path when a value contains function calls", () => {
    // "matrix(1, 0, 0, 1, 0, 0)" should be recognized as transform, not path
    expect(findInterpolator("matrix(1, 0, 0, 1, 0, 0)")?.name).toBe("transform")
  })

  it("returns null for unknown types", () => {
    expect(findInterpolator(Symbol("x"))).toBeNull()
    expect(findInterpolator(null)).toBeNull()
  })

  it("allows custom interpolators to be registered with priority", () => {
    registerInterpolator({
      name: "test-custom",
      test: (v) => typeof v === "string" && v.startsWith("@@custom:"),
      interpolate: (from, to) => {
        const a = Number.parseFloat((from as string).slice(9))
        const b = Number.parseFloat((to as string).slice(9))
        return (p) => `@@custom:${a + (b - a) * p}`
      },
    })
    const entry = findInterpolator("@@custom:10")
    expect(entry?.name).toBe("test-custom")
    const fn = interpolate("@@custom:0", "@@custom:10")
    expect(fn(0.5)).toBe("@@custom:5")
  })

  it("throws when no interpolator matches", () => {
    expect(() =>
      interpolate(Symbol("a") as unknown as string, Symbol("b") as unknown as string),
    ).toThrow()
  })
})
