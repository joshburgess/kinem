import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import { playCanvas } from "./canvas"

function makeRaf() {
  let nextId = 1
  const pending = new Map<number, (t: number) => void>()
  const raf: RafLike = {
    request(cb) {
      const id = nextId++
      pending.set(id, cb)
      return id
    },
    cancel(id) {
      pending.delete(id)
    },
  }
  return {
    raf,
    fire(time: number) {
      const entry = [...pending].at(-1)
      if (!entry) return
      const [id, cb] = entry
      pending.delete(id)
      cb(time)
    },
  }
}

function setup(opts: { initialTime?: number } = {}) {
  const m = makeRaf()
  let now = opts.initialTime ?? 0
  const scheduler = createFrameScheduler({ raf: m.raf, now: () => now })
  const clock = createClock({ now: () => now })
  return {
    scheduler,
    clock,
    raf: m,
    advance(ms: number) {
      now += ms
    },
    tick() {
      m.fire(now)
    },
  }
}

describe("playCanvas", () => {
  it("invokes commit with interpolated values over time", async () => {
    const env = setup()
    const seen: number[] = []
    const def = tween({ x: [0, 100] }, { duration: 100 })
    const h = playCanvas(def, (v: { x: number }) => seen.push(v.x), {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.advance(0)
    env.tick()
    env.advance(50)
    env.tick()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)).toBeGreaterThan(0)
    h.cancel()
    await h.finished.catch(() => {})
  })

  it("returns a TimingHandle with pause/resume/seek/reverse/cancel", async () => {
    const env = setup()
    const def = tween({ x: [0, 100] }, { duration: 100 })
    const h = playCanvas(def, () => {}, { scheduler: env.scheduler, clock: env.clock })
    expect(typeof h.pause).toBe("function")
    expect(typeof h.resume).toBe("function")
    expect(typeof h.seek).toBe("function")
    expect(typeof h.reverse).toBe("function")
    expect(typeof h.cancel).toBe("function")
    h.cancel()
    await h.finished.catch(() => {})
  })

  it("seek() updates progress and emits a value in range", async () => {
    const env = setup()
    const seen: number[] = []
    const def = tween({ x: [0, 100] }, { duration: 100 })
    const h = playCanvas(def, (v: { x: number }) => seen.push(v.x), {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    h.pause()
    h.seek(0.5)
    env.tick()
    const last = seen.at(-1)
    expect(last).toBeGreaterThanOrEqual(0)
    expect(last).toBeLessThanOrEqual(100)
    h.cancel()
    await h.finished.catch(() => {})
  })

  it("cancel() rejects the finished promise", async () => {
    const env = setup()
    const def = tween({ x: [0, 100] }, { duration: 1000 })
    const h = playCanvas(def, () => {}, { scheduler: env.scheduler, clock: env.clock })
    h.cancel()
    await expect(h.finished).rejects.toThrow("cancelled")
  })

  it("throws if duration is not finite and > 0", () => {
    const def = { duration: 0, interpolate: () => ({}) }
    expect(() => playCanvas(def as never, () => {})).toThrow()
  })

  it("progresses to completion and resolves finished", async () => {
    const env = setup()
    const def = tween({ x: [0, 100] }, { duration: 100 })
    const h = playCanvas(def, () => {}, { scheduler: env.scheduler, clock: env.clock })
    env.advance(150)
    env.tick()
    env.tick()
    await h.finished
    expect(h.state).toBe("finished")
  })
})
