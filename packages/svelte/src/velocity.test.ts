import { describe, expect, it, vi } from "vitest"
import { motionValue } from "./motion-value"
import { velocity } from "./velocity"

describe("velocity (svelte store)", () => {
  it("subscribe runs synchronously with the current velocity (0)", () => {
    const x = motionValue(0)
    const v = velocity(x)
    const samples: number[] = []
    v.subscribe((value) => samples.push(value))
    expect(samples[0]).toBe(0)
    v.destroy()
  })

  it("updates as the source updates", () => {
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    const x = motionValue(0)
    const v = velocity(x)
    now = 0
    x.set(50)
    now = 50
    x.set(150)
    expect(v.get()).toBeCloseTo(2000, -1)
    v.destroy()
    vi.restoreAllMocks()
  })
})
