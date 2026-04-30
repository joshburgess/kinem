import { describe, expect, it, vi } from "vitest"
import { combine, motionValue, transform } from "./motion-value"

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

  it("destroy unsubscribes from the source", () => {
    const x = motionValue(0)
    const op = transform(x, [0, 100], [0, 1])
    const spy = vi.fn()
    op.subscribe(spy)
    op.destroy()
    spy.mockClear()
    x.set(50)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe("combine (svelte)", () => {
  it("derives the initial value and tracks updates", () => {
    const x = motionValue(0)
    const y = motionValue(0)
    const sum = combine([x, y] as const, (a, b) => a + b)
    expect(sum.get()).toBe(0)
    x.set(3)
    expect(sum.get()).toBe(3)
    y.set(4)
    expect(sum.get()).toBe(7)
  })

  it("subscribe receives derived values", () => {
    const x = motionValue(2)
    const doubled = combine([x] as const, (a) => a * 2)
    const spy = vi.fn()
    doubled.subscribe(spy)
    expect(spy).toHaveBeenLastCalledWith(4)
    x.set(5)
    expect(spy).toHaveBeenLastCalledWith(10)
  })

  it("destroy unsubscribes from every source", () => {
    const x = motionValue(0)
    const y = motionValue(0)
    const sum = combine([x, y] as const, (a, b) => a + b)
    const spy = vi.fn()
    sum.subscribe(spy)
    sum.destroy()
    spy.mockClear()
    x.set(10)
    y.set(20)
    expect(spy).not.toHaveBeenCalled()
  })
})
