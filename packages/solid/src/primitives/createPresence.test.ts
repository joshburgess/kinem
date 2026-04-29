import { createRoot, createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { createPresence } from "./createPresence"

describe("createPresence (solid)", () => {
  it("starts present and rendering when when() is initially true", () => {
    createRoot((dispose) => {
      const [show] = createSignal(true)
      const presence = createPresence(show)
      expect(presence.isPresent()).toBe(true)
      expect(presence.shouldRender()).toBe(true)
      dispose()
    })
  })

  it("starts not-present but rendering=false when when() is initially false", () => {
    createRoot((dispose) => {
      const [show] = createSignal(false)
      const presence = createPresence(show)
      expect(presence.isPresent()).toBe(false)
      // No prior mount, so nothing to keep alive: shouldRender is true
      // (shouldRender stays open until safeToRemove or until consumer
      // explicitly drops the wrapper).
      expect(presence.shouldRender()).toBe(true)
      presence.safeToRemove()
      expect(presence.shouldRender()).toBe(false)
      dispose()
    })
  })

  it("flips isPresent to false but keeps shouldRender true after exit until safeToRemove", () => {
    createRoot((dispose) => {
      const [show, setShow] = createSignal(true)
      const presence = createPresence(show)
      expect(presence.isPresent()).toBe(true)
      expect(presence.shouldRender()).toBe(true)

      setShow(false)
      expect(presence.isPresent()).toBe(false)
      expect(presence.shouldRender()).toBe(true)

      presence.safeToRemove()
      expect(presence.shouldRender()).toBe(false)
      dispose()
    })
  })

  it("resets the removed latch when when() returns to true", () => {
    createRoot((dispose) => {
      const [show, setShow] = createSignal(true)
      const presence = createPresence(show)

      setShow(false)
      presence.safeToRemove()
      expect(presence.shouldRender()).toBe(false)

      setShow(true)
      expect(presence.isPresent()).toBe(true)
      expect(presence.shouldRender()).toBe(true)

      // Subsequent exit cycle should defer again.
      setShow(false)
      expect(presence.isPresent()).toBe(false)
      expect(presence.shouldRender()).toBe(true)
      dispose()
    })
  })
})
