/**
 * Property-based tests for `interpolateNumbers`. Verifies that
 * component-wise linear interpolation preserves length, hits endpoints
 * exactly, and matches scalar `interpolateNumber` per index.
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { KinemError } from "../core/errors"
import { interpolateNumber } from "./number"
import { interpolateNumbers } from "./numbers"

// Realistic animation magnitudes (pixels, scales, opacities). Constraining
// to a sane range avoids floating-point cancellation in `from + (to - from)`
// without weakening the test for any inputs the library is actually used on.
const finiteNumber = (): fc.Arbitrary<number> =>
  fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })

const sameLengthArrays = (): fc.Arbitrary<{ a: number[]; b: number[] }> =>
  fc.integer({ min: 1, max: 16 }).chain((n) =>
    fc.record({
      a: fc.array(finiteNumber(), { minLength: n, maxLength: n }),
      b: fc.array(finiteNumber(), { minLength: n, maxLength: n }),
    }),
  )

describe("interpolateNumbers (properties)", () => {
  it("preserves length and hits endpoints (within fp tolerance)", () => {
    fc.assert(
      fc.property(sameLengthArrays(), ({ a, b }) => {
        const fn = interpolateNumbers(a, b)
        const at0 = fn(0)
        const at1 = fn(1)
        expect(at0.length).toBe(a.length)
        expect(at1.length).toBe(b.length)
        for (let i = 0; i < a.length; i++) {
          const av = a[i] as number
          const bv = b[i] as number
          const scale = Math.max(1, Math.abs(av), Math.abs(bv))
          expect(Math.abs((at0[i] as number) - av)).toBeLessThanOrEqual(scale * 1e-9)
          expect(Math.abs((at1[i] as number) - bv)).toBeLessThanOrEqual(scale * 1e-9)
        }
      }),
    )
  })

  it("matches scalar interpolateNumber per index", () => {
    fc.assert(
      fc.property(
        sameLengthArrays(),
        fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
        ({ a, b }, p) => {
          const fn = interpolateNumbers(a, b)
          const out = fn(p)
          for (let i = 0; i < a.length; i++) {
            const expected = interpolateNumber(a[i] as number, b[i] as number)(p)
            expect(out[i]).toBeCloseTo(expected, 8)
          }
        },
      ),
    )
  })

  it("returns a fresh array each call (no aliasing)", () => {
    fc.assert(
      fc.property(sameLengthArrays(), ({ a, b }) => {
        const fn = interpolateNumbers(a, b)
        const x = fn(0.3)
        const y = fn(0.3)
        expect(x).not.toBe(y)
      }),
    )
  })

  it("throws KinemError on length mismatch", () => {
    fc.assert(
      fc.property(
        fc.array(finiteNumber(), { minLength: 1, maxLength: 8 }),
        fc.array(finiteNumber(), { minLength: 1, maxLength: 8 }),
        (a, b) => {
          fc.pre(a.length !== b.length)
          expect(() => interpolateNumbers(a, b)).toThrow(KinemError)
        },
      ),
    )
  })
})
