import { createLayoutGroup } from "@kinem/core"
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

  // Note: layoutId / layoutGroup integration relies on Solid's onMount and
  // onCleanup, which are no-ops under solid-js's SSR build (the build
  // Vitest resolves in Node). The integration is exercised by the
  // React, Vue, and Svelte adapter tests against the same shared core
  // registry; here we only verify the typed surface accepts the new
  // options without runtime errors.
  it("accepts layoutId and layoutGroup options without throwing", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    createRoot((dispose) => {
      const l = createLayout<HTMLDivElement>({
        layoutId: "shared-solid",
        layoutGroup: group,
      })
      const el = document.createElement("div")
      l.ref(el)
      dispose()
    })
    expect(typeof group.consume).toBe("function")
  })
})
