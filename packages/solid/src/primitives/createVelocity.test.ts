import { motionValue } from "@kinem/core"
import { createRoot } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { createVelocity } from "./createVelocity"

describe("createVelocity (solid)", () => {
  it("mirrors the source's per-second derivative", () => {
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    createRoot((dispose) => {
      const x = motionValue(0)
      const v = createVelocity(x)
      now = 0
      x.set(50)
      now = 50
      x.set(150)
      expect(v.get()).toBeCloseTo(2000, -1)
      dispose()
    })
    vi.restoreAllMocks()
  })

  it("destroys on dispose", () => {
    const x = motionValue(0)
    let vRef: ReturnType<typeof createVelocity> | null = null
    const spy = vi.fn()
    createRoot((dispose) => {
      const v = createVelocity(x)
      vRef = v
      v.on(spy)
      dispose()
    })
    vRef!.set(99)
    expect(spy).not.toHaveBeenCalled()
  })
})
