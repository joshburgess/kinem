import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { time } from "./time"

describe("time()", () => {
  let rafQueue: Array<(t: number) => void> = []
  let cancelled: Set<number> = new Set()
  let nextId = 0

  beforeEach(() => {
    rafQueue = []
    cancelled = new Set()
    nextId = 1
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void): number => {
      const id = nextId++
      rafQueue.push(cb)
      return id
    })
    vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
      cancelled.add(id)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const flush = (): void => {
    const queue = rafQueue
    rafQueue = []
    for (const cb of queue) cb(0)
  }

  it("starts ticking only after a listener is attached", () => {
    const t = time()
    expect(rafQueue).toHaveLength(0)
    const off = t.on(() => {})
    expect(rafQueue).toHaveLength(1)
    flush()
    expect(rafQueue).toHaveLength(1)
    off()
    t.destroy()
  })

  it("emits monotonically increasing values to subscribers", () => {
    const t = time()
    const samples: number[] = []
    const off = t.on((v) => samples.push(v))
    flush()
    flush()
    flush()
    off()
    expect(samples.length).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!)
    }
    t.destroy()
  })

  it("stops the rAF loop when the last listener detaches", () => {
    const t = time()
    const off1 = t.on(() => {})
    const off2 = t.on(() => {})
    flush()
    const idBefore = nextId
    off1()
    expect(cancelled.size).toBe(0)
    off2()
    expect(cancelled.size).toBe(1)
    rafQueue = []
    flush()
    expect(nextId).toBe(idBefore)
    t.destroy()
  })

  it("restarts when a listener is added after a stop", () => {
    const t = time()
    const off = t.on(() => {})
    off()
    expect(cancelled.size).toBeGreaterThanOrEqual(1)
    rafQueue = []
    const off2 = t.on(() => {})
    expect(rafQueue.length).toBeGreaterThanOrEqual(1)
    off2()
    t.destroy()
  })

  it("destroy() stops the loop and clears listeners", () => {
    const t = time()
    let calls = 0
    t.on(() => {
      calls++
    })
    flush()
    const before = calls
    t.destroy()
    rafQueue = []
    flush()
    expect(calls).toBe(before)
  })
})
