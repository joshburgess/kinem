import { frame } from "@kinem/core"
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

  it("ticks the spring and notifies subscribers as it animates", () => {
    const s = spring(0, { stiffness: 800, damping: 40, mass: 1 })
    const seen: number[] = []
    const off = s.subscribe((v) => seen.push(v))
    seen.length = 0
    s.set(100)
    // Drive enough ticks to reach the spring's natural completion. Each
    // flushSync runs one frame; advancing in 16ms steps simulates 60fps.
    let t = 0
    for (let i = 0; i < 200 && s.isAnimating; i++) {
      t += 16
      frame.flushSync(t)
    }
    expect(seen.length).toBeGreaterThan(0)
    // Final value should land on the target after the spring resolves.
    expect(seen[seen.length - 1]).toBe(100)
    expect(s.isAnimating).toBe(false)
    off()
  })

  it("set(target) called mid-flight cancels the previous spring", () => {
    const s = spring(0, { stiffness: 200, damping: 20 })
    s.set(100)
    expect(s.isAnimating).toBe(true)
    // Advance one frame so the prior tick captures startTime.
    frame.flushSync(0)
    s.set(50)
    expect(s.isAnimating).toBe(true)
    s.stop()
  })
})
