import { describe, expect, it, vi } from "vitest"
import { motionValue } from "./motion-value"
import { velocity } from "./velocity"

describe("velocity()", () => {
  it("starts at the source's current velocity", () => {
    const x = motionValue(0)
    const v = velocity(x)
    expect(v.get()).toBe(0)
    v.destroy()
  })

  it("updates when the source changes", () => {
    const x = motionValue(0)
    const v = velocity(x)
    let now = 1000
    vi.spyOn(performance, "now").mockImplementation(() => now)
    x.set(100)
    now += 50
    x.set(200)
    expect(v.get()).toBeCloseTo(2000, -1)
    v.destroy()
    vi.restoreAllMocks()
  })

  it("notifies listeners as the source updates", () => {
    const x = motionValue(0)
    const v = velocity(x)
    const samples: number[] = []
    v.on((value) => samples.push(value))
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    now = 0
    x.set(10)
    now = 16
    x.set(20)
    expect(samples.length).toBeGreaterThanOrEqual(1)
    v.destroy()
    vi.restoreAllMocks()
  })

  it("destroy() unsubscribes from the source", () => {
    const x = motionValue(0)
    const v = velocity(x)
    let calls = 0
    v.on(() => {
      calls++
    })
    v.destroy()
    x.set(1)
    x.set(2)
    expect(calls).toBe(0)
  })
})
