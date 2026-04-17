import { describe, expect, it } from "vitest"
import { type RafLike, createFrameScheduler } from "./frame"

/** RAF mock that never fires automatically — tests drive ticks manually. */
function makeRaf() {
  let nextId = 1
  const pending = new Map<number, (time: number) => void>()
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
    pendingCount: () => pending.size,
    /** Fire the most recently requested RAF with the given time. */
    fire(time: number) {
      if (pending.size === 0) throw new Error("no pending raf")
      const [id, cb] = [...pending].at(-1)!
      pending.delete(id)
      cb(time)
    },
  }
}

describe("frame scheduler", () => {
  it("runs scheduled jobs in phase order regardless of insertion order", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    const log: string[] = []
    s.schedule("render", () => log.push("render"))
    s.schedule("read", () => log.push("read"))
    s.schedule("update", () => log.push("update"))
    s.schedule("compute", () => log.push("compute"))
    m.fire(0)
    expect(log).toEqual(["read", "compute", "update", "render"])
  })

  it("enqueues into a later phase run in the same tick, after same-phase jobs", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    const log: string[] = []
    s.schedule("read", () => {
      log.push("r1")
      s.schedule("update", () => log.push("u-from-read"))
    })
    s.schedule("update", () => log.push("u1"))
    m.fire(0)
    expect(log).toEqual(["r1", "u1", "u-from-read"])
  })

  it("enqueues into the same or earlier phase defer to the next tick", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    const log: string[] = []
    s.schedule("update", () => {
      log.push("u1")
      s.schedule("read", () => log.push("r-next"))
      s.schedule("update", () => log.push("u-next"))
    })
    m.fire(0)
    expect(log).toEqual(["u1"])
    m.fire(16)
    expect(log).toEqual(["u1", "r-next", "u-next"])
  })

  it("keepalive jobs run every tick until cancelled", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    let count = 0
    const job = () => {
      count++
    }
    s.schedule("compute", job, { keepalive: true })
    m.fire(0)
    m.fire(16)
    m.fire(32)
    expect(count).toBe(3)
    s.cancel("compute", job)
    expect(m.pendingCount()).toBe(0)
  })

  it("cancels the RAF loop when all queues drain", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    s.schedule("update", () => {})
    expect(s.isRunning).toBe(true)
    m.fire(0)
    expect(s.isRunning).toBe(false)
    expect(m.pendingCount()).toBe(0)
  })

  it("stays running across ticks while keepalive jobs exist", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    s.schedule("render", () => {}, { keepalive: true })
    m.fire(0)
    expect(s.isRunning).toBe(true)
    m.fire(16)
    expect(s.isRunning).toBe(true)
  })

  it("reports delta between consecutive ticks and zero for the first", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    const deltas: number[] = []
    s.schedule(
      "compute",
      (state) => {
        deltas.push(state.delta)
      },
      { keepalive: true },
    )
    m.fire(1000)
    m.fire(1016)
    m.fire(1040)
    expect(deltas).toEqual([0, 16, 24])
  })

  it("flushSync runs a tick synchronously and still drains on next raf", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    let ran = 0
    s.schedule("update", () => {
      ran++
    })
    const state = s.flushSync(42)
    expect(ran).toBe(1)
    expect(state.time).toBe(42)
    expect(state.tick).toBe(0)
    expect(s.tick).toBe(1)
    expect(s.isRunning).toBe(false)
  })

  it("tick index advances monotonically", () => {
    const m = makeRaf()
    const s = createFrameScheduler({ raf: m.raf })
    s.schedule("read", () => {}, { keepalive: true })
    m.fire(0)
    m.fire(1)
    m.fire(2)
    expect(s.tick).toBe(3)
  })
})
