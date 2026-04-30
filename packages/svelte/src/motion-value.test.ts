import { describe, expect, it, vi } from "vitest"
import { motionValue, transform } from "./motion-value"

describe("motionValue (svelte store)", () => {
  it("get/set work", () => {
    const x = motionValue(0)
    expect(x.get()).toBe(0)
    x.set(10)
    expect(x.get()).toBe(10)
  })

  it("subscribe is invoked synchronously with the current value", () => {
    const x = motionValue(42)
    const spy = vi.fn()
    x.subscribe(spy)
    expect(spy).toHaveBeenCalledWith(42)
  })

  it("subscribe is invoked on each change", () => {
    const x = motionValue(0)
    const spy = vi.fn()
    const off = x.subscribe(spy)
    x.set(1)
    x.set(2)
    expect(spy).toHaveBeenCalledTimes(3) // initial + 2 sets
    off()
    x.set(3)
    expect(spy).toHaveBeenCalledTimes(3)
  })
})

describe("transform (svelte)", () => {
  it("derives the initial value", () => {
    const x = motionValue(50)
    const op = transform(x, [0, 100], [0, 1])
    expect(op.get()).toBe(0.5)
  })

  it("updates on source change", () => {
    const x = motionValue(0)
    const op = transform(x, [0, 100], [0, 1])
    x.set(75)
    expect(op.get()).toBe(0.75)
  })

  it("subscribe receives derived values", () => {
    const x = motionValue(0)
    const op = transform(x, [0, 100], [0, 1])
    const spy = vi.fn()
    op.subscribe(spy)
    x.set(50)
    expect(spy).toHaveBeenLastCalledWith(0.5)
  })
})
