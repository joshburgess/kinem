import { describe, expect, it } from "vitest"
import { spring } from "./spring"

describe("spring", () => {
  it("produces a finite, non-zero duration derived from the simulation", () => {
    const a = spring({ x: [0, 100] }, { stiffness: 200, damping: 15 })
    expect(a.duration).toBeGreaterThan(0)
    expect(Number.isFinite(a.duration)).toBe(true)
  })

  it("starts at `from` and ends at `to`", () => {
    const a = spring({ x: [0, 100] })
    expect(a.interpolate(0).x).toBe(0)
    expect(a.interpolate(1).x).toBe(100)
  })

  it("underdamped spring overshoots past the target at some point", () => {
    const a = spring({ x: [0, 100] }, { stiffness: 300, damping: 8 })
    let max = 0
    for (let i = 0; i <= 100; i++) {
      const v = a.interpolate(i / 100).x
      if (v > max) max = v
    }
    expect(max).toBeGreaterThan(100)
  })
})
