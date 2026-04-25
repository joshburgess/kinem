import { describe, expect, it } from "vitest"
import { jitter } from "./jitter"
import { tween } from "./tween"

describe("jitter", () => {
  it("passes through duration and easing of the wrapped def", () => {
    const inner = tween({ x: [0, 100] }, { duration: 750 })
    const j = jitter(inner)
    expect(j.duration).toBe(750)
    expect(j.easing).toBe(inner.easing)
  })

  it("produces values within `amplitude` of the underlying def", () => {
    const inner = tween({ x: [0, 100] }, { duration: 1000 })
    const j = jitter(inner, { amplitude: 5, frequency: 4, seed: 42 })
    for (let i = 0; i <= 10; i++) {
      const p = i / 10
      const baseX = inner.interpolate(p).x as number
      const jitX = j.interpolate(p).x as number
      expect(Math.abs(jitX - baseX)).toBeLessThanOrEqual(5 + 1e-9)
    }
  })

  it("is deterministic for the same seed", () => {
    const inner = tween({ x: [0, 100] })
    const a = jitter(inner, { amplitude: 3, seed: 7 })
    const b = jitter(inner, { amplitude: 3, seed: 7 })
    for (let i = 0; i <= 5; i++) {
      const p = i / 5
      expect(a.interpolate(p).x as number).toBeCloseTo(b.interpolate(p).x as number, 9)
    }
  })

  it("differs across seeds", () => {
    const inner = tween({ x: [0, 100] })
    const a = jitter(inner, { amplitude: 3, seed: 1 })
    const b = jitter(inner, { amplitude: 3, seed: 2 })
    let differs = false
    for (let i = 1; i < 5; i++) {
      const p = i / 5
      if (Math.abs((a.interpolate(p).x as number) - (b.interpolate(p).x as number)) > 1e-6) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  })

  it("only applies to the listed properties when `only` is set", () => {
    const inner = tween({ x: [0, 100], y: [0, 100] }, { duration: 1000 })
    const j = jitter(inner, { amplitude: 10, only: ["x"] })
    const v = j.interpolate(0.5)
    const baseY = inner.interpolate(0.5).y as number
    expect(v.y).toBe(baseY)
  })

  it("preserves properties metadata", () => {
    const inner = tween({ x: [0, 100], y: [0, 100] })
    const j = jitter(inner, { amplitude: 1 })
    expect(j.properties).toEqual(inner.properties)
  })
})
