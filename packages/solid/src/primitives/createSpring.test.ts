import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createSpring } from "./createSpring"

describe("createSpring (solid)", () => {
  it("starts at the initial value and returns it from get()", () => {
    createRoot((dispose) => {
      const s = createSpring(42)
      expect(s.get()).toBe(42)
      expect(s.isAnimating).toBe(false)
      dispose()
    })
  })

  it("jump() updates value synchronously and notifies subscribers", () => {
    createRoot((dispose) => {
      const s = createSpring(0)
      const seen: number[] = []
      s.subscribe((v) => seen.push(v))
      s.jump(10)
      expect(s.get()).toBe(10)
      expect(seen).toEqual([10])
      dispose()
    })
  })

  it("set() to the same value is a no-op", () => {
    createRoot((dispose) => {
      const s = createSpring(0)
      s.set(0)
      expect(s.isAnimating).toBe(false)
      dispose()
    })
  })

  it("set() starts a new spring", () => {
    createRoot((dispose) => {
      const s = createSpring(0, { stiffness: 200 })
      s.set(100)
      expect(s.isAnimating).toBe(true)
      s.stop()
      expect(s.isAnimating).toBe(false)
      dispose()
    })
  })

  it("subscribe() returns an unsubscribe function", () => {
    createRoot((dispose) => {
      const s = createSpring(0)
      let calls = 0
      const unsub = s.subscribe(() => calls++)
      s.jump(5)
      unsub()
      s.jump(10)
      expect(calls).toBe(1)
      dispose()
    })
  })
})
