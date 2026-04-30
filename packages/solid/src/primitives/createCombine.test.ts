import { motionValue } from "@kinem/core"
import { createRoot } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { createCombine } from "./createCombine"

describe("createCombine (solid)", () => {
  it("derives the initial value and tracks updates", () => {
    createRoot((dispose) => {
      const x = motionValue(0)
      const y = motionValue(0)
      const sum = createCombine([x, y] as const, (a, b) => a + b)
      expect(sum.get()).toBe(0)
      x.set(3)
      expect(sum.get()).toBe(3)
      y.set(4)
      expect(sum.get()).toBe(7)
      dispose()
    })
  })

  it("destroys on dispose", () => {
    const x = motionValue(0)
    let captured: ReturnType<typeof createCombine<readonly [typeof x], number>> | null = null
    const spy = vi.fn()
    createRoot((dispose) => {
      const sum = createCombine([x] as const, (a) => a * 2)
      captured = sum
      sum.on(spy)
      dispose()
    })
    x.set(99)
    expect(spy).not.toHaveBeenCalled()
    expect(captured!.get()).toBe(0)
  })
})
