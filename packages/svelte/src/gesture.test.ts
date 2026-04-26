import { tween } from "@kinem/core"
import { describe, expect, it } from "vitest"
import { gesture } from "./gesture"

const enterAnim = () => tween({ opacity: [0, 1] }, { duration: 50 })

describe("gesture (svelte action)", () => {
  it("returns update/destroy/cancel functions", () => {
    const el = document.createElement("div")
    const ret = gesture(el, { drag: { axis: "x" } })
    expect(typeof ret.update).toBe("function")
    expect(typeof ret.destroy).toBe("function")
    expect(typeof ret.cancel).toBe("function")
    ret.destroy()
  })

  it("binds drag when drag opts are provided", () => {
    const el = document.createElement("div")
    const ret = gesture(el, { drag: { axis: "x" } })
    expect(() => ret.destroy()).not.toThrow()
  })

  it("binds hover when hover opts are provided", () => {
    const el = document.createElement("div")
    const ret = gesture(el, { hover: { enter: enterAnim() } })
    expect(() => ret.destroy()).not.toThrow()
  })

  it("destroy() is safe to call with no opts", () => {
    const el = document.createElement("div")
    const ret = gesture(el, {})
    expect(() => ret.destroy()).not.toThrow()
  })

  it("cancel() is safe to call multiple times", () => {
    const el = document.createElement("div")
    const ret = gesture(el, { drag: {}, hover: { enter: enterAnim() } })
    expect(() => ret.cancel()).not.toThrow()
    expect(() => ret.cancel()).not.toThrow()
    ret.destroy()
  })

  it("update() rebinds gestures with new opts", () => {
    const el = document.createElement("div")
    const ret = gesture(el, { drag: { axis: "x" } })
    expect(() => ret.update({ drag: { axis: "y" }, hover: { enter: enterAnim() } })).not.toThrow()
    ret.destroy()
  })
})
