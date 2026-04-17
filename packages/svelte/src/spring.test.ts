import { describe, expect, it } from "vitest"
import { spring } from "./spring"

describe("spring (svelte store)", () => {
  it("subscribe invokes immediately with the initial value", () => {
    const s = spring(42)
    const seen: number[] = []
    const off = s.subscribe((v) => seen.push(v))
    expect(seen).toEqual([42])
    off()
  })

  it("jump sets synchronously and notifies subscribers", () => {
    const s = spring(0)
    const seen: number[] = []
    const off = s.subscribe((v) => seen.push(v))
    seen.length = 0
    s.jump(10)
    expect(seen).toEqual([10])
    off()
  })

  it("set(target) with target === current is a no-op", () => {
    const s = spring(5)
    s.set(5)
    expect(s.isAnimating).toBe(false)
  })

  it("set(target) starts a spring; stop() cancels it", () => {
    const s = spring(0)
    s.set(100)
    expect(s.isAnimating).toBe(true)
    s.stop()
    expect(s.isAnimating).toBe(false)
  })

  it("update(fn) uses the current value to compute the target", () => {
    const s = spring(10)
    s.update((v) => v + 90)
    expect(s.isAnimating).toBe(true)
    s.stop()
  })

  it("unsubscribe stops further notifications", () => {
    const s = spring(0)
    const seen: number[] = []
    const off = s.subscribe((v) => seen.push(v))
    seen.length = 0
    off()
    s.jump(1)
    expect(seen).toEqual([])
  })
})
