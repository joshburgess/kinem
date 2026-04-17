import { describe, expect, it } from "vitest"
import { parallel, sequence } from "../core/animation"
import { easeOut, linear, springEasing } from "../core/easing"
import { tween } from "./tween"

describe("tween", () => {
  it("interpolates a single numeric property", () => {
    const t = tween({ opacity: [0, 1] }, { duration: 300 })
    expect(t.duration).toBe(300)
    expect(t.interpolate(0)).toEqual({ opacity: 0 })
    expect(t.interpolate(1)).toEqual({ opacity: 1 })
    expect(t.interpolate(0.5)).toEqual({ opacity: 0.5 })
  })

  it("interpolates multiple heterogeneous properties", () => {
    const t = tween(
      { x: [0, 100], color: ["#000000", "#ffffff"], opacity: [0, 1] },
      { duration: 500 },
    )
    const v = t.interpolate(0.5)
    expect(v.x).toBe(50)
    expect(typeof v.color).toBe("string")
    expect(v.opacity).toBeCloseTo(0.5, 10)
  })

  it("applies easing", () => {
    const t = tween({ x: [0, 100] }, { duration: 300, easing: easeOut })
    expect(t.interpolate(0.5).x).toBeGreaterThan(50)
  })

  it("defaults to linear easing and 400ms duration", () => {
    const t = tween({ x: [0, 100] })
    expect(t.duration).toBe(400)
    expect(t.easing).toBe(linear)
  })

  it("infers duration from a spring easing", () => {
    const easing = springEasing({ stiffness: 200, damping: 20 })
    const t = tween({ x: [0, 100] }, { easing })
    expect(t.duration).toBe(easing.duration)
  })

  it("composes with sequence and parallel", () => {
    const a = tween({ x: [0, 100] }, { duration: 100 })
    const b = tween({ x: [100, 200] }, { duration: 100 })
    const s = sequence(a, b)
    expect(s.duration).toBe(200)
    expect(s.interpolate(1).x).toBe(200)

    const p = parallel(a, b)
    expect(p.duration).toBe(100)
    const pv = p.interpolate(1)
    expect(pv).toHaveLength(2)
  })

  it("interpolates CSS units", () => {
    const t = tween({ width: ["0px", "100px"] })
    expect(t.interpolate(0.5).width).toBe("50px")
  })

  it("rejects non-pair arrays (use keyframes for 3+ stops)", () => {
    expect(() => tween({ y: [0, 50, 100] })).toThrow(/pair/)
  })
})
