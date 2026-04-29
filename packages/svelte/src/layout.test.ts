import { describe, expect, it } from "vitest"
import { layout } from "./layout"

describe("layout (svelte action)", () => {
  it("returns update and destroy functions", () => {
    const el = document.createElement("div")
    const ret = layout(el, { duration: 100 })
    expect(typeof ret.update).toBe("function")
    expect(typeof ret.destroy).toBe("function")
    ret.destroy()
  })

  it("accepts an empty opts object", () => {
    const el = document.createElement("div")
    expect(() => {
      const ret = layout(el)
      ret.destroy()
    }).not.toThrow()
  })

  it("update() is safe to call even when no rect change occurs", () => {
    const el = document.createElement("div")
    const ret = layout(el, { duration: 50 })
    expect(() => ret.update({ duration: 80 })).not.toThrow()
    ret.destroy()
  })

  it("destroy() is safe to call multiple times", () => {
    const el = document.createElement("div")
    const ret = layout(el, {})
    expect(() => ret.destroy()).not.toThrow()
    expect(() => ret.destroy()).not.toThrow()
  })

  it("respects animateScale: false in update opts", () => {
    const el = document.createElement("div")
    const ret = layout(el, { animateScale: false, duration: 50 })
    expect(() => ret.update({ animateScale: false, duration: 60 })).not.toThrow()
    ret.destroy()
  })
})
