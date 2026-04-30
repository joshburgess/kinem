import { createRoot } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { createMotionValue } from "./createMotionValue"

describe("createMotionValue (solid)", () => {
  it("returns a MotionValue with the initial value", () => {
    createRoot((dispose) => {
      const mv = createMotionValue(42)
      expect(mv.get()).toBe(42)
      dispose()
    })
  })

  it("destroys the cell on dispose", () => {
    const spy = vi.fn()
    let mvRef: ReturnType<typeof createMotionValue<number>> | null = null
    createRoot((dispose) => {
      const mv = createMotionValue(0)
      mvRef = mv
      mv.on(spy)
      dispose()
    })
    mvRef!.set(99)
    expect(spy).not.toHaveBeenCalled()
  })
})
