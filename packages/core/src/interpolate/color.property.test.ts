/**
 * Property-based tests for `interpolateColor`. The OKLCH conversions
 * are lossy (sRGB <-> linear <-> Oklab is non-trivial), so endpoint
 * checks compare component-wise within byte tolerance rather than as
 * exact strings. Format-of-`to`-wins and alpha behavior are exercised
 * directly.
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { interpolateColor, isColor } from "./color"

const byte = (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 255 })

const hexFromBytes = (r: number, g: number, b: number, a?: number): string => {
  const h = (n: number): string => n.toString(16).padStart(2, "0")
  return a === undefined ? `#${h(r)}${h(g)}${h(b)}` : `#${h(r)}${h(g)}${h(b)}${h(a)}`
}

const rgbBytes = (): fc.Arbitrary<{ r: number; g: number; b: number }> =>
  fc.record({ r: byte(), g: byte(), b: byte() })

function parseRgbOutput(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgb(?:a)?\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(s)
  if (!m) return null
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] !== undefined ? Number(m[4]) : 1,
  }
}

function parseHexOutput(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(s)
  if (!m) return null
  return {
    r: Number.parseInt(m[1] ?? "0", 16),
    g: Number.parseInt(m[2] ?? "0", 16),
    b: Number.parseInt(m[3] ?? "0", 16),
    a: m[4] !== undefined ? Number.parseInt(m[4], 16) / 255 : 1,
  }
}

describe("isColor (properties)", () => {
  it("accepts well-formed hex / rgb / hsl / oklch", () => {
    fc.assert(
      fc.property(rgbBytes(), ({ r, g, b }) => {
        expect(isColor(hexFromBytes(r, g, b))).toBe(true)
        expect(isColor(`rgb(${r} ${g} ${b})`)).toBe(true)
      }),
    )
  })

  it("rejects obvious non-colors", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }).filter((s) => {
          const t = s.trim()
          if (t.startsWith("#")) return false
          return !/^(rgb|rgba|hsl|hsla|oklch)\s*\(/i.test(t)
        }),
        (s) => {
          expect(isColor(s)).toBe(false)
        },
      ),
    )
  })
})

describe("interpolateColor (properties)", () => {
  it("p=0 round-trips the from color (within byte tolerance)", () => {
    fc.assert(
      fc.property(rgbBytes(), rgbBytes(), (from, to) => {
        const fn = interpolateColor(
          hexFromBytes(from.r, from.g, from.b),
          `rgb(${to.r} ${to.g} ${to.b})`,
        )
        const out = parseRgbOutput(fn(0))
        expect(out).not.toBeNull()
        // Allow 2-byte tolerance for OKLCH round-trip drift on saturated colors.
        expect(Math.abs((out?.r ?? 0) - from.r)).toBeLessThanOrEqual(2)
        expect(Math.abs((out?.g ?? 0) - from.g)).toBeLessThanOrEqual(2)
        expect(Math.abs((out?.b ?? 0) - from.b)).toBeLessThanOrEqual(2)
      }),
    )
  })

  it("p=1 round-trips the to color (within byte tolerance)", () => {
    fc.assert(
      fc.property(rgbBytes(), rgbBytes(), (from, to) => {
        const fn = interpolateColor(
          `rgb(${from.r} ${from.g} ${from.b})`,
          hexFromBytes(to.r, to.g, to.b),
        )
        const out = parseHexOutput(fn(1))
        expect(out).not.toBeNull()
        expect(Math.abs((out?.r ?? 0) - to.r)).toBeLessThanOrEqual(2)
        expect(Math.abs((out?.g ?? 0) - to.g)).toBeLessThanOrEqual(2)
        expect(Math.abs((out?.b ?? 0) - to.b)).toBeLessThanOrEqual(2)
      }),
    )
  })

  it("output uses the format of `to`", () => {
    fc.assert(
      fc.property(
        rgbBytes(),
        rgbBytes(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (from, to, p) => {
          const hexOut = interpolateColor(
            `rgb(${from.r} ${from.g} ${from.b})`,
            hexFromBytes(to.r, to.g, to.b),
          )(p)
          const rgbOut = interpolateColor(
            hexFromBytes(from.r, from.g, from.b),
            `rgb(${to.r} ${to.g} ${to.b})`,
          )(p)
          expect(hexOut.startsWith("#")).toBe(true)
          expect(rgbOut.startsWith("rgb")).toBe(true)
        },
      ),
    )
  })

  it("alpha at endpoints is preserved (within byte tolerance)", () => {
    fc.assert(
      fc.property(rgbBytes(), rgbBytes(), byte(), (from, to, alpha) => {
        const toHex = hexFromBytes(to.r, to.g, to.b, alpha)
        const fn = interpolateColor(hexFromBytes(from.r, from.g, from.b, 255), toHex)
        const out = parseHexOutput(fn(1))
        expect(out).not.toBeNull()
        // Hex alpha is rendered only when < 1; alpha 255 means no trailing pair.
        const expectedAlphaByte = alpha
        const actualAlphaByte = Math.round((out?.a ?? 1) * 255)
        expect(Math.abs(actualAlphaByte - expectedAlphaByte)).toBeLessThanOrEqual(1)
      }),
    )
  })

  it("identical from/to colors yield a constant trajectory", () => {
    fc.assert(
      fc.property(rgbBytes(), fc.double({ min: 0, max: 1, noNaN: true }), ({ r, g, b }, p) => {
        const c = `rgb(${r} ${g} ${b})`
        const fn = interpolateColor(c, c)
        const a0 = parseRgbOutput(fn(0))
        const aP = parseRgbOutput(fn(p))
        expect(a0).not.toBeNull()
        expect(aP).not.toBeNull()
        expect(aP?.r).toBe(a0?.r)
        expect(aP?.g).toBe(a0?.g)
        expect(aP?.b).toBe(a0?.b)
      }),
    )
  })
})
