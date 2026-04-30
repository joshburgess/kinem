import { describe, expect, it } from "vitest"
import { isSpringEasing, linear } from "../core/easing"
import { resolveTransition } from "./transition"

describe("resolveTransition", () => {
  it("uses the default tween duration when no transition is given", () => {
    const r = resolveTransition(undefined)
    expect(r.duration).toBe(400)
    expect(r.easing).toBeUndefined()
  })

  it("uses tween fields directly when type='tween' or implied", () => {
    const r = resolveTransition({ duration: 200, easing: linear })
    expect(r.duration).toBe(200)
    expect(r.easing).toBe(linear)
  })

  it("respects an explicit type='tween'", () => {
    const r = resolveTransition({ type: "tween", duration: 100 })
    expect(r.duration).toBe(100)
  })

  it("builds a spring easing for type='spring'", () => {
    const r = resolveTransition({ type: "spring", stiffness: 200, damping: 20 })
    expect(typeof r.easing).toBe("function")
    expect(isSpringEasing(r.easing!)).toBe(true)
    // The settling time depends on the integrator but should be a
    // small positive number (well under the default maxDuration).
    expect(r.duration).toBeGreaterThan(0)
    expect(r.duration).toBeLessThan(10_000)
  })

  it("infers spring when any spring field is present without type", () => {
    const r = resolveTransition({ stiffness: 200, damping: 20 })
    expect(isSpringEasing(r.easing!)).toBe(true)
  })

  it("lets the caller override the spring's auto duration", () => {
    const r = resolveTransition({ type: "spring", stiffness: 200, damping: 20, duration: 300 })
    expect(r.duration).toBe(300)
  })

  it("treats type='spring' with no fields as the default spring", () => {
    const r = resolveTransition({ type: "spring" })
    expect(isSpringEasing(r.easing!)).toBe(true)
  })
})
