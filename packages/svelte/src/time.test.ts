import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { time } from "./time"

describe("time (svelte store)", () => {
  let queue: Array<(t: number) => void> = []

  beforeEach(() => {
    queue = []
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void): number => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal("cancelAnimationFrame", (): void => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("subscribe runs synchronously with the current value", () => {
    const t = time()
    const samples: number[] = []
    const off = t.subscribe((v) => samples.push(v))
    expect(samples[0]).toBe(0)
    off()
    t.destroy()
  })

  it("subscribe receives tick updates", () => {
    const t = time()
    const samples: number[] = []
    const off = t.subscribe((v) => samples.push(v))
    const cb = queue.shift()
    if (cb) cb(0)
    expect(samples.length).toBeGreaterThanOrEqual(2)
    off()
    t.destroy()
  })
})
