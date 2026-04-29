/**
 * Property-based tests for `interpolateNumber`.
 *
 * Verifies the algebraic invariants of linear interpolation against
 * randomly-generated inputs from fast-check. These complement the
 * example-based tests in `number.test.ts` by exploring the input space
 * more broadly and by encoding the intended properties directly.
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { interpolateNumber } from "./number"

// Realistic animation magnitudes (pixels, scales, opacities). Constraining
// to a sane range avoids floating-point cancellation in `from + (to - from)`
// without weakening the test for any inputs the library is actually used on.
const finiteNumber = (): fc.Arbitrary<number> =>
  fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })

const unitProgress = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true })

describe("interpolateNumber (properties)", () => {
  it("returns from at p=0 and to at p=1 (within fp tolerance)", () => {
    fc.assert(
      fc.property(finiteNumber(), finiteNumber(), (from, to) => {
        const fn = interpolateNumber(from, to)
        const scale = Math.max(1, Math.abs(from), Math.abs(to))
        expect(Math.abs(fn(0) - from)).toBeLessThanOrEqual(scale * 1e-9)
        expect(Math.abs(fn(1) - to)).toBeLessThanOrEqual(scale * 1e-9)
      }),
    )
  })

  it("midpoint equals the arithmetic mean (within fp tolerance)", () => {
    fc.assert(
      fc.property(finiteNumber(), finiteNumber(), (from, to) => {
        const fn = interpolateNumber(from, to)
        const mid = (from + to) / 2
        expect(fn(0.5)).toBeCloseTo(mid, 8)
      }),
    )
  })

  it("output stays within [min(from,to), max(from,to)] for p in [0,1]", () => {
    fc.assert(
      fc.property(finiteNumber(), finiteNumber(), unitProgress(), (from, to, p) => {
        const fn = interpolateNumber(from, to)
        const lo = Math.min(from, to)
        const hi = Math.max(from, to)
        const v = fn(p)
        const eps = Math.max(1, Math.abs(lo), Math.abs(hi)) * 1e-9
        expect(v).toBeGreaterThanOrEqual(lo - eps)
        expect(v).toBeLessThanOrEqual(hi + eps)
      }),
    )
  })

  it("is monotonic in p (non-decreasing if to>=from, non-increasing if to<=from)", () => {
    fc.assert(
      fc.property(
        finiteNumber(),
        finiteNumber(),
        unitProgress(),
        unitProgress(),
        (from, to, p1, p2) => {
          const fn = interpolateNumber(from, to)
          const [lo, hi] = p1 <= p2 ? [p1, p2] : [p2, p1]
          const a = fn(lo)
          const b = fn(hi)
          if (to >= from) {
            expect(a).toBeLessThanOrEqual(b + 1e-9)
          } else {
            expect(a).toBeGreaterThanOrEqual(b - 1e-9)
          }
        },
      ),
    )
  })

  it("collapses to the constant when from === to", () => {
    fc.assert(
      fc.property(finiteNumber(), fc.double({ min: -2, max: 2, noNaN: true }), (v, p) => {
        const fn = interpolateNumber(v, v)
        // delta is 0 so the result is `v + 0 * p` which is exactly `v`
        // for finite v (use === so +0 / -0 compare equal).
        expect(fn(p) === v).toBe(true)
      }),
    )
  })

  it("symmetry: interpolateNumber(a, b)(p) === interpolateNumber(b, a)(1 - p) (within fp epsilon)", () => {
    fc.assert(
      fc.property(finiteNumber(), finiteNumber(), unitProgress(), (a, b, p) => {
        const lhs = interpolateNumber(a, b)(p)
        const rhs = interpolateNumber(b, a)(1 - p)
        // Linear interpolation is associative-only up to floating point; for
        // very large operands the absolute drift is non-trivial. Use a
        // magnitude-relative tolerance instead of toBeCloseTo (which compares
        // against an absolute epsilon).
        const scale = Math.max(1, Math.abs(a), Math.abs(b))
        expect(Math.abs(lhs - rhs)).toBeLessThanOrEqual(scale * 1e-7)
      }),
    )
  })
})
