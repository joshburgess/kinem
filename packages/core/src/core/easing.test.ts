import { describe, expect, it } from "vitest"
import { cubicBezier, easeIn, easeInOut, easeOut, linear, springEasing, steps } from "./easing"

describe("easing", () => {
  describe("linear", () => {
    it("passes progress through unchanged", () => {
      expect(linear(0)).toBe(0)
      expect(linear(0.5)).toBe(0.5)
      expect(linear(1)).toBe(1)
    })
  })

  describe("easeIn / easeOut / easeInOut", () => {
    it("hits endpoints exactly", () => {
      for (const fn of [easeIn, easeOut, easeInOut]) {
        expect(fn(0)).toBe(0)
        expect(fn(1)).toBe(1)
      }
    })

    it("easeIn is slow at the start", () => {
      expect(easeIn(0.25)).toBeLessThan(0.25)
      expect(easeIn(0.5)).toBeLessThan(0.5)
    })

    it("easeOut is fast at the start", () => {
      expect(easeOut(0.25)).toBeGreaterThan(0.25)
      expect(easeOut(0.5)).toBeGreaterThan(0.5)
    })

    it("easeInOut is symmetric around 0.5", () => {
      expect(easeInOut(0.5)).toBeCloseTo(0.5, 10)
      for (const p of [0.1, 0.25, 0.4]) {
        expect(easeInOut(p) + easeInOut(1 - p)).toBeCloseTo(1, 10)
      }
    })
  })

  describe("cubicBezier", () => {
    it("linear-equivalent bezier matches linear", () => {
      const fn = cubicBezier(0.333, 0.333, 0.667, 0.667)
      for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        expect(fn(p)).toBeCloseTo(p, 3)
      }
    })

    it("hits endpoints exactly", () => {
      const fn = cubicBezier(0.42, 0, 0.58, 1)
      expect(fn(0)).toBe(0)
      expect(fn(1)).toBe(1)
    })

    it("standard ease matches known samples", () => {
      // CSS "ease" is cubic-bezier(0.25, 0.1, 0.25, 1)
      const ease = cubicBezier(0.25, 0.1, 0.25, 1)
      expect(ease(0.25)).toBeGreaterThan(0.4)
      expect(ease(0.5)).toBeGreaterThan(0.75)
    })

    it("clamps out-of-range input", () => {
      const fn = cubicBezier(0.42, 0, 0.58, 1)
      expect(fn(-1)).toBe(0)
      expect(fn(2)).toBe(1)
    })
  })

  describe("steps", () => {
    it("end position: standard CSS behavior", () => {
      const s = steps(4, "end")
      expect(s(0)).toBe(0)
      expect(s(0.24)).toBe(0)
      expect(s(0.26)).toBe(0.25)
      expect(s(0.51)).toBe(0.5)
      expect(s(0.99)).toBe(0.75)
      expect(s(1)).toBe(0.75)
    })

    it("start position: jump on leading edge", () => {
      const s = steps(4, "start")
      expect(s(0)).toBe(0.25)
      expect(s(0.26)).toBe(0.5)
      expect(s(1)).toBe(1)
    })

    it("rejects n < 1", () => {
      expect(() => steps(0)).toThrow()
      expect(() => steps(-1)).toThrow()
    })

    it("n=1 end produces a single step at t=1", () => {
      const s = steps(1, "end")
      expect(s(0)).toBe(0)
      expect(s(0.99)).toBe(0)
      expect(s(1)).toBe(0)
    })
  })

  describe("spring", () => {
    it("starts at 0 and converges to 1", () => {
      const s = springEasing({ stiffness: 200, damping: 20, mass: 1 })
      expect(s(0)).toBe(0)
      expect(s(1)).toBe(1)
      expect(Math.abs(s(0.999) - 1)).toBeLessThan(0.01)
    })

    it("has a finite, positive duration", () => {
      const s = springEasing()
      expect(s.duration).toBeGreaterThan(0)
      expect(Number.isFinite(s.duration)).toBe(true)
    })

    it("higher stiffness settles faster than a softer spring", () => {
      const stiff = springEasing({ stiffness: 500, damping: 30, mass: 1 })
      const soft = springEasing({ stiffness: 100, damping: 30, mass: 1 })
      expect(stiff.duration).toBeLessThan(soft.duration)
    })

    it("underdamped spring overshoots past 1 at some point", () => {
      const s = springEasing({ stiffness: 300, damping: 8, mass: 1 })
      let overshoot = 0
      for (let i = 0; i <= 100; i++) {
        const v = s(i / 100)
        if (v > overshoot) overshoot = v
      }
      expect(overshoot).toBeGreaterThan(1)
    })

    it("overdamped spring stays monotonic", () => {
      const s = springEasing({ stiffness: 100, damping: 80, mass: 1 })
      let prev = Number.NEGATIVE_INFINITY
      for (let i = 0; i <= 100; i++) {
        const v = s(i / 100)
        expect(v).toBeGreaterThanOrEqual(prev - 1e-6)
        prev = v
      }
    })
  })
})
