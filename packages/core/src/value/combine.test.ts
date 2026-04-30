import { describe, expect, it } from "vitest"
import { combine } from "./combine"
import { motionValue } from "./motion-value"

describe("combine()", () => {
  it("derives the initial value from current source values", () => {
    const x = motionValue(3)
    const y = motionValue(4)
    const d = combine([x, y], (a, b) => Math.hypot(a, b))
    expect(d.get()).toBeCloseTo(5)
    d.destroy()
  })

  it("updates when any single source changes", () => {
    const x = motionValue(0)
    const y = motionValue(0)
    const sum = combine([x, y], (a, b) => a + b)

    const samples: number[] = []
    sum.on((v) => samples.push(v))

    x.set(2)
    expect(sum.get()).toBe(2)
    y.set(5)
    expect(sum.get()).toBe(7)
    expect(samples).toEqual([2, 7])
    sum.destroy()
  })

  it("supports heterogeneous source types", () => {
    const n = motionValue(2)
    const s = motionValue("x")
    const tagged = combine([n, s], (count, label) => `${label}:${count}`)
    expect(tagged.get()).toBe("x:2")
    n.set(7)
    expect(tagged.get()).toBe("x:7")
    s.set("y")
    expect(tagged.get()).toBe("y:7")
    tagged.destroy()
  })

  it("does not emit when fn produces an Object.is-equal result", () => {
    const x = motionValue(0)
    const y = motionValue(0)
    const max = combine([x, y], (a, b) => Math.max(a, b))
    const samples: number[] = []
    max.on((v) => samples.push(v))
    x.set(5)
    y.set(3) // max stays 5
    y.set(4) // max stays 5
    y.set(10)
    expect(samples).toEqual([5, 10])
    max.destroy()
  })

  it("destroy() unsubscribes from every source", () => {
    const x = motionValue(0)
    const y = motionValue(0)
    const sum = combine([x, y], (a, b) => a + b)
    let calls = 0
    sum.on(() => {
      calls++
    })
    sum.destroy()
    x.set(1)
    y.set(2)
    expect(calls).toBe(0)
    expect(sum.get()).toBe(0)
  })

  it("supports a single-source combine", () => {
    const x = motionValue(2)
    const doubled = combine([x], (a) => a * 2)
    expect(doubled.get()).toBe(4)
    x.set(5)
    expect(doubled.get()).toBe(10)
    doubled.destroy()
  })
})
