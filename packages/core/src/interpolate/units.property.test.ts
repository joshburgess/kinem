/**
 * Property-based tests for `parseUnit` / `interpolateUnit`. Covers
 * round-trip parsing, endpoint correctness, the zero-unitless adoption
 * rule, and the `UnitMismatchError` path for incompatible units.
 */

import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import { UnitMismatchError, interpolateUnit, parseUnit } from "./units"

const cssUnits = ["", "px", "rem", "em", "%", "vh", "vw", "deg", "rad"] as const
type CssUnit = (typeof cssUnits)[number]

const reasonableNumber = (): fc.Arbitrary<number> =>
  fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })

const cssUnit = (): fc.Arbitrary<CssUnit> => fc.constantFrom(...cssUnits)

const unitString = (): fc.Arbitrary<{ value: number; unit: CssUnit; source: string }> =>
  fc.record({ value: reasonableNumber(), unit: cssUnit() }).map(({ value, unit }) => ({
    value,
    unit,
    source: `${value}${unit}`,
  }))

describe("parseUnit (properties)", () => {
  it("round-trips a generated number+unit string", () => {
    fc.assert(
      fc.property(unitString(), ({ value, unit, source }) => {
        const parsed = parseUnit(source)
        expect(parsed).not.toBeNull()
        expect(parsed?.value).toBeCloseTo(value, 6)
        expect(parsed?.unit).toBe(unit)
      }),
    )
  })

  it("returns null for non-numeric input", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => !/^\s*[+-]?(\d|\.)/.test(s)),
        (s) => {
          expect(parseUnit(s)).toBeNull()
        },
      ),
    )
  })
})

describe("interpolateUnit (properties)", () => {
  it("hits endpoints when units match", () => {
    fc.assert(
      fc.property(reasonableNumber(), reasonableNumber(), cssUnit(), (a, b, unit) => {
        const fn = interpolateUnit(`${a}${unit}`, `${b}${unit}`)
        const at0 = parseUnit(fn(0))
        const at1 = parseUnit(fn(1))
        expect(at0?.unit).toBe(unit)
        expect(at1?.unit).toBe(unit)
        expect(at0?.value).toBeCloseTo(a, 6)
        expect(at1?.value).toBeCloseTo(b, 6)
      }),
    )
  })

  it("midpoint equals the arithmetic mean when units match", () => {
    fc.assert(
      fc.property(reasonableNumber(), reasonableNumber(), cssUnit(), (a, b, unit) => {
        const fn = interpolateUnit(`${a}${unit}`, `${b}${unit}`)
        const mid = parseUnit(fn(0.5))
        expect(mid?.unit).toBe(unit)
        expect(mid?.value).toBeCloseTo((a + b) / 2, 6)
      }),
    )
  })

  it("zero unitless adopts the other side's unit", () => {
    fc.assert(
      fc.property(
        reasonableNumber(),
        cssUnit().filter((u) => u !== ""),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (v, unit, p) => {
          const fnA = interpolateUnit("0", `${v}${unit}`)
          const fnB = interpolateUnit(`${v}${unit}`, "0")
          expect(parseUnit(fnA(p))?.unit).toBe(unit)
          expect(parseUnit(fnB(p))?.unit).toBe(unit)
        },
      ),
    )
  })

  it("throws UnitMismatchError when units differ and neither side is zero unitless", () => {
    fc.assert(
      fc.property(
        reasonableNumber().filter((n) => n !== 0),
        reasonableNumber().filter((n) => n !== 0),
        cssUnit(),
        cssUnit(),
        (a, b, unitA, unitB) => {
          fc.pre(unitA !== unitB)
          expect(() => interpolateUnit(`${a}${unitA}`, `${b}${unitB}`)).toThrow(UnitMismatchError)
        },
      ),
    )
  })
})
