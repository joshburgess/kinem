import { describe, expect, it } from "vitest"
import { kinemTransition } from "./transition"

describe("kinemTransition (svelte transition)", () => {
  it("returns duration, easing, and a tick function", () => {
    const el = document.createElement("div")
    const cfg = kinemTransition(el, {
      from: { opacity: 0 },
      to: { opacity: 1 },
      duration: 300,
    })
    expect(cfg.duration).toBe(300)
    expect(typeof cfg.tick).toBe("function")
  })

  it("tick(0) applies the `from` values and tick(1) applies the `to` values", () => {
    const el = document.createElement("div")
    const cfg = kinemTransition(el, {
      from: { opacity: 0 },
      to: { opacity: 1 },
      duration: 300,
    })
    cfg.tick?.(0, 1)
    expect(el.style.opacity).toBe("0")
    cfg.tick?.(1, 0)
    expect(el.style.opacity).toBe("1")
  })

  it("tick(0.5) applies an interpolated value", () => {
    const el = document.createElement("div")
    const cfg = kinemTransition(el, {
      from: { opacity: 0 },
      to: { opacity: 1 },
    })
    cfg.tick?.(0.5, 0.5)
    expect(Number.parseFloat(el.style.opacity)).toBeCloseTo(0.5, 2)
  })

  it("interpolates CSS units (e.g. px)", () => {
    const el = document.createElement("div")
    const cfg = kinemTransition(el, {
      from: { width: "0px" },
      to: { width: "100px" },
    })
    cfg.tick?.(0.25, 0.75)
    expect(el.style.width).toBe("25px")
  })

  it("defaults duration to 400ms when unspecified", () => {
    const el = document.createElement("div")
    const cfg = kinemTransition(el, {
      from: { opacity: 0 },
      to: { opacity: 1 },
    })
    expect(cfg.duration).toBe(400)
  })

  it("skips keys that are missing from either side", () => {
    const el = document.createElement("div")
    const cfg = kinemTransition(el, {
      from: { opacity: 0 },
      to: { opacity: 1, color: "rgb(255, 0, 0)" },
    })
    expect(() => cfg.tick?.(0.5, 0.5)).not.toThrow()
  })
})
