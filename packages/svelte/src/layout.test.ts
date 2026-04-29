import { createLayoutGroup } from "@kinem/core"
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

  it("captures the last rect under layoutId on destroy", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    const el = document.createElement("div")
    const fakeRect = { left: 11, top: 22, width: 33, height: 44 } as DOMRect
    el.getBoundingClientRect = () => fakeRect
    const ret = layout(el, { layoutId: "shared-z", layoutGroup: group })
    ret.destroy()
    const snap = group.consume("shared-z")
    expect(snap?.rect.left).toBe(11)
    expect(snap?.rect.top).toBe(22)
    expect(snap?.rect.width).toBe(33)
    expect(snap?.rect.height).toBe(44)
  })

  it("consumes a captured rect on bind under matching layoutId", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    group.capture("shared-w", { left: 1, top: 2, width: 3, height: 4 })
    const el = document.createElement("div")
    const ret = layout(el, { layoutId: "shared-w", layoutGroup: group })
    expect(group.consume("shared-w")).toBeUndefined()
    ret.destroy()
  })
})
