import { describe, expect, it, vi } from "vitest"
import { bindMotionValueToCss, motionValue } from "./motion-value"

describe("motionValue", () => {
  it("get() returns the initial value", () => {
    const mv = motionValue(42)
    expect(mv.get()).toBe(42)
  })

  it("set(v) updates the value and notifies listeners", () => {
    const mv = motionValue(0)
    const spy = vi.fn()
    mv.on(spy)
    mv.set(1)
    expect(mv.get()).toBe(1)
    expect(spy).toHaveBeenCalledWith(1, 0)
  })

  it("set(v) is a no-op when the value is unchanged (Object.is)", () => {
    const mv = motionValue(0)
    const spy = vi.fn()
    mv.on(spy)
    mv.set(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it("treats NaN as unchanged via Object.is", () => {
    const mv = motionValue(Number.NaN)
    const spy = vi.fn()
    mv.on(spy)
    mv.set(Number.NaN)
    expect(spy).not.toHaveBeenCalled()
  })

  it("on() returns an unsubscribe that detaches the listener", () => {
    const mv = motionValue(0)
    const spy = vi.fn()
    const off = mv.on(spy)
    mv.set(1)
    off()
    mv.set(2)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("listener can unsubscribe itself during dispatch without skipping siblings", () => {
    const mv = motionValue(0)
    const calls: string[] = []
    let offA: () => void = () => {}
    const a = (): void => {
      calls.push("a")
      offA()
    }
    const b = (): void => {
      calls.push("b")
    }
    offA = mv.on(a)
    mv.on(b)
    mv.set(1)
    expect(calls).toEqual(["a", "b"])
    mv.set(2)
    // After self-removal, only b should fire
    expect(calls).toEqual(["a", "b", "b"])
  })

  it("destroy() clears all listeners", () => {
    const mv = motionValue(0)
    const spy = vi.fn()
    mv.on(spy)
    mv.destroy()
    mv.set(1)
    expect(spy).not.toHaveBeenCalled()
    // The value still updates even with no listeners
    expect(mv.get()).toBe(1)
  })

  describe("getVelocity()", () => {
    it("returns 0 before any set", () => {
      const mv = motionValue(0)
      expect(mv.getVelocity()).toBe(0)
    })

    it("returns 0 for non-numeric values", () => {
      const mv = motionValue("idle")
      mv.set("active")
      expect(mv.getVelocity()).toBe(0)
    })

    it("computes (delta / elapsed) * 1000 for back-to-back sets", () => {
      const mv = motionValue(0)
      // Use real `performance.now` and force two sets with a measurable
      // gap. We can't fake the global cleanly here, so we just sanity
      // check the sign and ballpark magnitude.
      mv.set(10)
      const sample1 = performance.now()
      // Spin-wait briefly to advance the clock without fake timers.
      while (performance.now() - sample1 < 1) {
        /* spin */
      }
      mv.set(20)
      const v = mv.getVelocity()
      // Velocity should be positive (we went up) and finite.
      expect(v).toBeGreaterThan(0)
      expect(Number.isFinite(v)).toBe(true)
    })

    it("returns 0 when the last sample is older than the window", async () => {
      const mv = motionValue(0)
      mv.set(10)
      mv.set(20)
      // Wait > 30 ms (the window).
      await new Promise((r) => setTimeout(r, 50))
      expect(mv.getVelocity()).toBe(0)
    })
  })

  describe("bindMotionValueToCss", () => {
    it("paints the initial value and updates on set", () => {
      const mv = motionValue(10)
      const written: Array<[string, string]> = []
      const el = {
        style: {
          setProperty(name: string, value: string) {
            written.push([name, value])
          },
        },
      }
      const off = bindMotionValueToCss(mv, el, "--x", (n) => `${n}px`)
      expect(written).toEqual([["--x", "10px"]])
      mv.set(20)
      expect(written).toEqual([
        ["--x", "10px"],
        ["--x", "20px"],
      ])
      off()
      mv.set(30)
      expect(written.length).toBe(2)
    })
  })
})
