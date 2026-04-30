import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createMotionValue } from "./createMotionValue"
import { createTransform } from "./createTransform"

describe("createTransform (solid)", () => {
  it("derives the initial value", () => {
    createRoot((dispose) => {
      const x = createMotionValue(50)
      const op = createTransform(x, [0, 100], [0, 1])
      expect(op.get()).toBe(0.5)
      dispose()
    })
  })

  it("updates when source updates", () => {
    createRoot((dispose) => {
      const x = createMotionValue(0)
      const op = createTransform(x, [0, 100], [0, 1])
      x.set(50)
      expect(op.get()).toBe(0.5)
      x.set(100)
      expect(op.get()).toBe(1)
      dispose()
    })
  })

  it("destroys the derived cell on dispose", () => {
    let derived: ReturnType<typeof createTransform<number>> | null = null
    createRoot((dispose) => {
      const x = createMotionValue(0)
      derived = createTransform(x, [0, 100], [0, 1])
      dispose()
    })
    derived!.set(99)
    expect(derived!.get()).toBe(99)
  })
})
