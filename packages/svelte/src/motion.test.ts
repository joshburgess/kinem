import { describe, expect, it } from "vitest"
import { motion } from "./motion"

describe("motion (svelte action)", () => {
  it("applies `initial` as inline styles synchronously", () => {
    const el = document.createElement("div")
    motion(el, { initial: { opacity: 0 } })
    expect(el.style.opacity).toBe("0")
  })

  it("returns update/destroy functions", () => {
    const el = document.createElement("div")
    const ret = motion(el, { initial: { opacity: 0 } })
    expect(typeof ret.update).toBe("function")
    expect(typeof ret.destroy).toBe("function")
  })

  it("destroy() is safe to call with no in-flight tween", () => {
    const el = document.createElement("div")
    const ret = motion(el, {})
    expect(() => ret.destroy()).not.toThrow()
  })

  it("update() with the same animate values is a no-op", () => {
    const el = document.createElement("div")
    const ret = motion(el, {
      initial: { width: "0px" },
      animate: { width: "50px" },
      transition: { duration: 20, backend: "raf" },
    })
    expect(() =>
      ret.update({ animate: { width: "50px" }, transition: { duration: 20, backend: "raf" } }),
    ).not.toThrow()
    ret.destroy()
  })

  it("update() with new animate values does not throw", () => {
    const el = document.createElement("div")
    const ret = motion(el, {
      initial: { width: "0px" },
      animate: { width: "50px" },
      transition: { duration: 20, backend: "raf" },
    })
    expect(() =>
      ret.update({ animate: { width: "100px" }, transition: { duration: 20, backend: "raf" } }),
    ).not.toThrow()
    ret.destroy()
  })

  it("destroy() cancels an in-flight animation", () => {
    const el = document.createElement("div")
    const ret = motion(el, {
      initial: { width: "0px" },
      animate: { width: "100px" },
      transition: { duration: 1000, backend: "raf" },
    })
    expect(() => ret.destroy()).not.toThrow()
  })
})
