import { describe, expect, it } from "vitest"
import { createClock } from "./clock"

function mockNow(initial = 0) {
  let t = initial
  const fn = (): number => t
  return {
    now: fn,
    advance(ms: number) {
      t += ms
    },
    set(ms: number) {
      t = ms
    },
  }
}

describe("clock", () => {
  it("starts at virtual time zero and advances with real time", () => {
    const r = mockNow(1000)
    const c = createClock({ now: r.now })
    expect(c.now()).toBe(0)
    r.advance(250)
    expect(c.now()).toBe(250)
  })

  it("pause freezes virtual time; resume continues from where it stopped", () => {
    const r = mockNow()
    const c = createClock({ now: r.now })
    r.advance(100)
    c.pause()
    expect(c.now()).toBe(100)
    r.advance(500)
    expect(c.now()).toBe(100)
    expect(c.paused).toBe(true)
    c.resume()
    expect(c.paused).toBe(false)
    r.advance(50)
    expect(c.now()).toBe(150)
  })

  it("double-pause and double-resume are idempotent", () => {
    const r = mockNow()
    const c = createClock({ now: r.now })
    r.advance(10)
    c.pause()
    c.pause()
    r.advance(100)
    expect(c.now()).toBe(10)
    c.resume()
    c.resume()
    r.advance(20)
    expect(c.now()).toBe(30)
  })

  it("setSpeed scales virtual time going forward without rewriting the past", () => {
    const r = mockNow()
    const c = createClock({ now: r.now })
    r.advance(100)
    expect(c.now()).toBe(100)
    c.setSpeed(2)
    r.advance(50)
    expect(c.now()).toBe(200)
    c.setSpeed(0.5)
    r.advance(100)
    expect(c.now()).toBe(250)
  })

  it("setSpeed works while paused (takes effect after resume)", () => {
    const r = mockNow()
    const c = createClock({ now: r.now })
    r.advance(100)
    c.pause()
    c.setSpeed(4)
    r.advance(1000)
    expect(c.now()).toBe(100)
    c.resume()
    r.advance(10)
    expect(c.now()).toBe(140)
  })

  it("rejects non-positive speeds", () => {
    const c = createClock({ now: mockNow().now })
    expect(() => c.setSpeed(0)).toThrow()
    expect(() => c.setSpeed(-1)).toThrow()
    expect(() => createClock({ speed: 0 })).toThrow()
  })

  it("reset restores virtual time to zero", () => {
    const r = mockNow()
    const c = createClock({ now: r.now })
    r.advance(500)
    expect(c.now()).toBe(500)
    c.reset()
    expect(c.now()).toBe(0)
    r.advance(10)
    expect(c.now()).toBe(10)
  })

  it("is monotonically non-decreasing under normal use", () => {
    const r = mockNow()
    const c = createClock({ now: r.now })
    let prev = c.now()
    for (let i = 0; i < 100; i++) {
      r.advance(1)
      const cur = c.now()
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })
})
