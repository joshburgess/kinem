import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createReducedMotion } from "./createReducedMotion"

describe("createReducedMotion (solid)", () => {
  it("returns an accessor that defaults to false", () => {
    createRoot((dispose) => {
      const reduce = createReducedMotion()
      expect(typeof reduce).toBe("function")
      expect(reduce()).toBe(false)
      dispose()
    })
  })

  it("does not throw in environments without matchMedia", () => {
    const original = window.matchMedia
    // @ts-expect-error force absence for the test
    window.matchMedia = undefined
    try {
      createRoot((dispose) => {
        expect(() => createReducedMotion()).not.toThrow()
        dispose()
      })
    } finally {
      window.matchMedia = original
    }
  })
})
