import { describe, expect, it } from "vitest"
import { KinemError } from "../core/errors"
import { interpolateNumbers } from "./numbers"

describe("interpolateNumbers", () => {
  it("hits endpoints exactly for vec3", () => {
    const fn = interpolateNumbers([0, 0, 0], [1, 2, 3])
    expect(fn(0)).toEqual([0, 0, 0])
    expect(fn(1)).toEqual([1, 2, 3])
  })

  it("blends component-wise through the midpoint", () => {
    const fn = interpolateNumbers([0, 10, -10], [10, 20, 0])
    expect(fn(0.5)).toEqual([5, 15, -5])
  })

  it("extrapolates outside [0, 1]", () => {
    const fn = interpolateNumbers([0, 0], [1, 1])
    expect(fn(-0.5)).toEqual([-0.5, -0.5])
    expect(fn(1.5)).toEqual([1.5, 1.5])
  })

  it("works for empty arrays (degenerate case)", () => {
    const fn = interpolateNumbers([], [])
    expect(fn(0)).toEqual([])
    expect(fn(1)).toEqual([])
  })

  it("returns a fresh array per call (no aliasing)", () => {
    const fn = interpolateNumbers([0, 0], [1, 1])
    const a = fn(0.25)
    const b = fn(0.75)
    expect(a).not.toBe(b)
    expect(a).toEqual([0.25, 0.25])
    expect(b).toEqual([0.75, 0.75])
  })

  it("supports flat 16-element matrices", () => {
    const from = new Array(16).fill(0)
    const to = new Array(16).fill(2)
    const fn = interpolateNumbers(from, to)
    expect(fn(0.5)).toEqual(new Array(16).fill(1))
  })

  it("throws KinemError on length mismatch", () => {
    expect(() => interpolateNumbers([0, 0], [1, 2, 3])).toThrowError(KinemError)
    expect(() => interpolateNumbers([0, 0], [1, 2, 3])).toThrow(/length mismatch/)
  })
})
