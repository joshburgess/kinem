import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createLayout } from "./createLayout"

describe("createLayout (solid)", () => {
  it("returns a ref binding and a measure() function", () => {
    createRoot((dispose) => {
      const l = createLayout<HTMLDivElement>({ duration: 100 })
      expect(typeof l.ref).toBe("function")
      expect(typeof l.measure).toBe("function")
      dispose()
    })
  })

  it("does not throw when measure() runs without a prior layout", () => {
    createRoot((dispose) => {
      const l = createLayout<HTMLDivElement>({ duration: 50 })
      const el = document.createElement("div")
      l.ref(el)
      expect(() => l.measure()).not.toThrow()
      dispose()
    })
  })

  it("respects animateScale: false without throwing", () => {
    createRoot((dispose) => {
      const l = createLayout<HTMLDivElement>({ animateScale: false })
      const el = document.createElement("div")
      l.ref(el)
      expect(() => l.measure()).not.toThrow()
      dispose()
    })
  })

  it("accepts an empty opts object", () => {
    createRoot((dispose) => {
      const l = createLayout<HTMLDivElement>()
      const el = document.createElement("div")
      l.ref(el)
      dispose()
    })
  })
})
