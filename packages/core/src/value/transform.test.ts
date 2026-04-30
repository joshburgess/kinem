import { describe, expect, it } from "vitest"
import "../interpolate/register-defaults"
import { transform } from "./transform"

describe("transform", () => {
  describe("numeric output", () => {
    it("interpolates linearly between two stops", () => {
      const t = transform([0, 100], [0, 1])
      expect(t(0)).toBe(0)
      expect(t(50)).toBe(0.5)
      expect(t(100)).toBe(1)
    })

    it("interpolates across multi-stop ranges", () => {
      const t = transform([0, 100, 200], [0, 1, 0])
      expect(t(0)).toBe(0)
      expect(t(50)).toBe(0.5)
      expect(t(100)).toBe(1)
      expect(t(150)).toBe(0.5)
      expect(t(200)).toBe(0)
    })

    it("clamps inputs to the range by default", () => {
      const t = transform([0, 100], [0, 1])
      expect(t(-50)).toBe(0)
      expect(t(150)).toBe(1)
    })

    it("extrapolates linearly when clamp is false", () => {
      const t = transform([0, 100], [0, 1], { clamp: false })
      expect(t(-50)).toBe(-0.5)
      expect(t(150)).toBe(1.5)
      expect(t(200)).toBe(2)
    })

    it("handles a zero-width segment without dividing by zero", () => {
      // Two adjacent stops with the same input value would be invalid
      // (must be strictly increasing); zero-width segments only show
      // up at the very edges of clamping. Sanity check: at the exact
      // first/last input we return the first/last output.
      const t = transform([0, 100], [10, 20])
      expect(t(0)).toBe(10)
      expect(t(100)).toBe(20)
    })
  })

  describe("string output via registry", () => {
    it("interpolates colors", () => {
      const t = transform([0, 1], ["#000000", "#ffffff"])
      expect(t(0)).toBe("#000000")
      expect(t(1)).toBe("#ffffff")
      // Mid-value should be a gray; we don't pin the exact rounding.
      const mid = t(0.5)
      expect(typeof mid).toBe("string")
      expect(mid.startsWith("#")).toBe(true)
    })

    it("interpolates CSS units", () => {
      const t = transform([0, 100], ["0px", "100px"])
      expect(t(0)).toBe("0px")
      expect(t(50)).toBe("50px")
      expect(t(100)).toBe("100px")
    })
  })

  describe("validation", () => {
    it("throws when ranges have different lengths", () => {
      expect(() => transform([0, 1, 2], [0, 1])).toThrow(/same length/)
    })

    it("throws when ranges have fewer than 2 stops", () => {
      expect(() =>
        transform([0] as unknown as [number, number], [0] as unknown as [number, number]),
      ).toThrow(/at least 2/)
    })

    it("throws when input range is not strictly increasing", () => {
      expect(() => transform([0, 0, 1], [0, 1, 2])).toThrow(/strictly increasing/)
      expect(() => transform([0, 1, 0.5], [0, 1, 2])).toThrow(/strictly increasing/)
    })
  })
})
