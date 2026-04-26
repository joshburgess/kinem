import { tween } from "@kinem/core"
import { describe, expect, it } from "vitest"
import { scroll } from "./scroll"

describe("scroll (svelte action)", () => {
  it("returns update/destroy functions", () => {
    const el = document.createElement("div")
    const def = tween({ opacity: [0, 1] }, { duration: 200 })
    const ret = scroll(el, { def })
    expect(typeof ret.update).toBe("function")
    expect(typeof ret.destroy).toBe("function")
    ret.destroy()
  })

  it("destroy() is safe to call repeatedly", () => {
    const el = document.createElement("div")
    const def = tween({ opacity: [0, 1] }, { duration: 200 })
    const ret = scroll(el, { def })
    expect(() => ret.destroy()).not.toThrow()
    expect(() => ret.destroy()).not.toThrow()
  })

  it("update() with the same def is a no-op", () => {
    const el = document.createElement("div")
    const def = tween({ opacity: [0, 1] }, { duration: 200 })
    const ret = scroll(el, { def })
    expect(() => ret.update({ def })).not.toThrow()
    ret.destroy()
  })

  it("update() with a new def cancels and rebinds", () => {
    const el = document.createElement("div")
    const def1 = tween({ opacity: [0, 1] }, { duration: 200 })
    const def2 = tween({ opacity: [1, 0] }, { duration: 200 })
    const ret = scroll(el, { def: def1 })
    expect(() => ret.update({ def: def2 })).not.toThrow()
    ret.destroy()
  })

  it("accepts opts on bind", () => {
    const el = document.createElement("div")
    const def = tween({ opacity: [0, 1] }, { duration: 200 })
    const ret = scroll(el, { def, opts: { sync: true } })
    expect(() => ret.destroy()).not.toThrow()
  })
})
