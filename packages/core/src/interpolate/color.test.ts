import { describe, expect, it } from "vitest"
import { interpolateColor, isColor } from "./color"

describe("isColor", () => {
  it("identifies hex colors", () => {
    expect(isColor("#fff")).toBe(true)
    expect(isColor("#ff0000")).toBe(true)
    expect(isColor("#ff0000ff")).toBe(true)
  })

  it("identifies CSS color functions", () => {
    expect(isColor("rgb(255, 0, 0)")).toBe(true)
    expect(isColor("hsl(0 100% 50%)")).toBe(true)
    expect(isColor("oklch(0.7 0.2 30)")).toBe(true)
  })

  it("rejects non-color strings", () => {
    expect(isColor("100px")).toBe(false)
    expect(isColor("auto")).toBe(false)
  })
})

describe("interpolateColor", () => {
  it("endpoints roundtrip hex", () => {
    const fn = interpolateColor("#000000", "#ffffff")
    expect(fn(0)).toBe("#000000")
    expect(fn(1)).toBe("#ffffff")
  })

  it("maintains the target's format", () => {
    const hex = interpolateColor("rgb(0 0 0)", "#ffffff")
    expect(hex(1).startsWith("#")).toBe(true)

    const rgb = interpolateColor("#000000", "rgb(255 255 255)")
    expect(rgb(1).startsWith("rgb")).toBe(true)

    const oklch = interpolateColor("#000000", "oklch(1 0 0)")
    expect(oklch(1).startsWith("oklch")).toBe(true)
  })

  it("black-to-white midpoint differs from naive sRGB midpoint (OKLCH perceptual)", () => {
    const fn = interpolateColor("#000000", "#ffffff")
    const mid = fn(0.5)
    // sRGB midpoint would be #808080 (128,128,128). OKLCH midpoint at L=0.5
    // corresponds to a perceptual 50% lightness, which (because sRGB is
    // gamma-encoded) maps to a lower sRGB byte value near ~100.
    expect(mid).not.toBe("#808080")
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/.exec(mid)
    expect(m).not.toBeNull()
    const r = Number.parseInt(m?.[1] ?? "0", 16)
    const g = Number.parseInt(m?.[2] ?? "0", 16)
    const b = Number.parseInt(m?.[3] ?? "0", 16)
    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(r).toBeGreaterThan(50)
    expect(r).toBeLessThan(128)
  })

  it("interpolates alpha channel", () => {
    const fn = interpolateColor("rgb(255 0 0 / 0)", "rgb(255 0 0 / 1)")
    expect(fn(0)).toContain("/ 0")
    expect(fn(1)).toBe("rgb(255 0 0)")
  })

  it("takes the shortest hue arc (350° -> 10° goes through 0°, not 180°)", () => {
    const fn = interpolateColor("oklch(0.7 0.2 350)", "oklch(0.7 0.2 10)")
    const mid = fn(0.5)
    // Parse hue from "oklch(L C H)"
    const m = /^oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(mid)
    expect(m).not.toBeNull()
    const h = Number.parseFloat(m?.[1] ?? "0")
    // Midway between 350 and 10 via shortest arc is 0 (or 360).
    expect(Math.min(Math.abs(h - 0), Math.abs(h - 360))).toBeLessThan(1)
  })

  it("parses hsl()", () => {
    const fn = interpolateColor("hsl(0 100% 50%)", "hsl(120 100% 50%)")
    const start = fn(0)
    expect(start.startsWith("hsl")).toBe(true)
  })

  it("throws on unparseable input", () => {
    expect(() => interpolateColor("notacolor", "#000")).toThrow()
  })

  it("throws on malformed rgb()", () => {
    expect(() => interpolateColor("#000", "rgb(only-one-arg)")).toThrow(/cannot parse/)
  })

  it("throws on malformed hsl()", () => {
    expect(() => interpolateColor("#000", "hsl(only-one)")).toThrow(/cannot parse/)
  })

  it("throws on malformed oklch()", () => {
    expect(() => interpolateColor("#000", "oklch(too-few)")).toThrow(/cannot parse/)
  })

  it("throws on malformed hex", () => {
    expect(() => interpolateColor("#0", "#000")).toThrow(/cannot parse/)
    expect(() => interpolateColor("#00000", "#000")).toThrow(/cannot parse/)
  })

  it("renders oklch with alpha < 1 in the alpha-bearing form", () => {
    const fn = interpolateColor("oklch(0.5 0.1 200 / 0.4)", "oklch(0.5 0.1 200 / 0.4)")
    const out = fn(0)
    expect(out).toContain("/")
  })

  it("renders rgb with fractional alpha", () => {
    const fn = interpolateColor("rgb(255 0 0 / 0.25)", "rgb(255 0 0 / 0.25)")
    expect(fn(0)).toContain("/")
  })

  it("renders hsl with fractional alpha", () => {
    const fn = interpolateColor("hsl(0 100% 50% / 0.5)", "hsl(0 100% 50% / 0.5)")
    expect(fn(0)).toContain("/")
  })

  it("parses 4-digit hex (rgba shorthand)", () => {
    const fn = interpolateColor("#f00f", "#f00f")
    expect(fn(0)).toBe("#ff0000")
  })

  it("parses 8-digit hex (with alpha)", () => {
    const fn = interpolateColor("#ff000080", "#ff000080")
    const out = fn(0)
    // Alpha < 1 should add a trailing alpha pair to the hex.
    expect(out.length).toBe(9)
  })

  it("rejects unrecognized format prefixes", () => {
    expect(() => interpolateColor("#000", "xyz(0 0 0)")).toThrow(/cannot parse/)
  })

  it("parses hsl across the full hue wheel", () => {
    // hp >= 3 (cyan/blue/magenta) covers the late branches in hslToRgb.
    for (const hue of [180, 240, 300]) {
      const fn = interpolateColor(`hsl(${hue} 100% 50%)`, `hsl(${hue} 100% 50%)`)
      const out = fn(0)
      expect(out.startsWith("hsl")).toBe(true)
    }
  })

  it("renders hsl output where green or blue is the max channel", () => {
    // Tween between two greens — output format is hsl, parser exercises the
    // max==g branch in rgbToHsl.
    const greenFn = interpolateColor("hsl(120 100% 50%)", "hsl(120 100% 50%)")
    expect(greenFn(0).startsWith("hsl")).toBe(true)
    // And a blue, to hit max==b.
    const blueFn = interpolateColor("hsl(240 100% 50%)", "hsl(240 100% 50%)")
    expect(blueFn(0).startsWith("hsl")).toBe(true)
  })
})
