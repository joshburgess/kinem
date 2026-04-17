import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import { stagger } from "../core/animation"
import { fromGrid, shuffle, wave } from "./stagger-patterns"

describe("fromGrid", () => {
  it("origin at center: corners have the largest order", () => {
    const fn = fromGrid({ rows: 3, cols: 3, origin: "center" })
    const center = fn(4, 9) // row 1, col 1
    const corner = fn(0, 9) // row 0, col 0
    expect(center).toBe(0)
    expect(corner).toBeGreaterThan(center)
  })

  it("origin 'start' stages from top-left", () => {
    const fn = fromGrid({ rows: 2, cols: 2, origin: "start" })
    expect(fn(0, 4)).toBe(0)
    expect(fn(3, 4)).toBeCloseTo(Math.sqrt(2), 5)
  })

  it("manhattan metric produces diamond contours", () => {
    const fn = fromGrid({ rows: 3, cols: 3, origin: "center", metric: "manhattan" })
    expect(fn(1, 9)).toBe(1) // row 0, col 1 → |0-1| + |1-1| = 1
    expect(fn(3, 9)).toBe(1) // row 1, col 0
    expect(fn(0, 9)).toBe(2) // row 0, col 0
  })

  it("chebyshev metric produces square contours", () => {
    const fn = fromGrid({ rows: 3, cols: 3, origin: "center", metric: "chebyshev" })
    expect(fn(0, 9)).toBe(1) // corner distance via chebyshev is 1
    expect(fn(1, 9)).toBe(1)
  })

  it("explicit origin tuple", () => {
    const fn = fromGrid({ rows: 4, cols: 4, origin: [0, 3] })
    expect(fn(3, 16)).toBe(0) // row 0, col 3 is the origin
  })

  it("throws when rows or cols < 1", () => {
    expect(() => fromGrid({ rows: 0, cols: 3 })).toThrow()
    expect(() => fromGrid({ rows: 3, cols: 0 })).toThrow()
  })

  it("composes with stagger()", () => {
    const a = tween({ x: [0, 1] }, { duration: 100 })
    const s = stagger(a, { each: 10, count: 9, from: fromGrid({ rows: 3, cols: 3 }) })
    expect(s.duration).toBeGreaterThan(100)
  })
})

describe("shuffle", () => {
  it("produces a permutation of 0..n-1", () => {
    const fn = shuffle({ seed: 42 })
    const count = 10
    const seen = new Set<number>()
    for (let i = 0; i < count; i++) seen.add(fn(i, count))
    expect(seen.size).toBe(count)
    for (let i = 0; i < count; i++) expect(seen.has(i)).toBe(true)
  })

  it("is deterministic with a seed", () => {
    const fn1 = shuffle({ seed: 7 })
    const fn2 = shuffle({ seed: 7 })
    for (let i = 0; i < 8; i++) expect(fn1(i, 8)).toBe(fn2(i, 8))
  })
})

describe("wave", () => {
  it("returns linear order when amplitude is 0", () => {
    const fn = wave({ amplitude: 0 })
    for (let i = 0; i < 5; i++) expect(fn(i, 5)).toBe(i)
  })

  it("modulates around the base index", () => {
    const fn = wave({ amplitude: 2, frequency: 1 })
    const count = 5
    const vals: number[] = []
    for (let i = 0; i < count; i++) vals.push(fn(i, count))
    // first and last are at t=0 and t=1 so sin(0)=0, sin(2π)=0
    expect(vals[0]).toBeCloseTo(0, 5)
    expect(vals[count - 1]).toBeCloseTo(count - 1, 5)
  })

  it("never offsets beyond ±amplitude", () => {
    const fn = wave({ amplitude: 3, frequency: 2 })
    const count = 20
    for (let i = 0; i < count; i++) {
      const v = fn(i, count)
      expect(Math.abs(v - i)).toBeLessThanOrEqual(3 + 1e-9)
    }
  })
})

describe("stagger() with custom StaggerFn", () => {
  it("normalizes negative order values to 0", () => {
    const a = tween({ x: [0, 1] }, { duration: 100 })
    const fn = () => -5 // everyone has order -5; normalizes to 0 → synchronous
    const s = stagger(a, { each: 10, count: 4, from: fn })
    expect(s.duration).toBe(100)
  })

  it("integer-seeded wave pattern composes cleanly", () => {
    const a = tween({ x: [0, 1] }, { duration: 100 })
    const s = stagger(a, { each: 20, count: 8, from: wave({ amplitude: 1 }) })
    expect(s.duration).toBeGreaterThan(100)
  })
})
