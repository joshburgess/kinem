import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import type { ElementShim } from "./apply"
import { playRaf } from "./raf"

function makeEl(): ElementShim & { styles: Map<string, string> } {
  const styles = new Map<string, string>()
  return {
    styles,
    style: {
      setProperty(name, value) {
        styles.set(name, value)
      },
    },
    setAttribute() {},
  }
}

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
      if (!entry) throw new Error("no pending raf")
      const [id, cb] = entry
      pending.delete(id)
      cb(time)
    },
    pendingCount: () => pending.size,
  }
}

function setup(opts: { initialTime?: number } = {}) {
  const m = makeRaf()
  let now = opts.initialTime ?? 0
  const scheduler = createFrameScheduler({
    raf: m.raf,
    now: () => now,
  })
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

describe("rAF backend", () => {
  it("applies initial values on the first frame", () => {
    const el = makeEl()
    const env = setup()
    playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    expect(el.styles.get("opacity")).toBe("0")
  })

  it("interpolates over time and finishes at t=duration", async () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(50)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0.5, 5)
    env.advance(60)
    env.tick()
    expect(el.styles.get("opacity")).toBe("1")
    expect(h.state).toBe("finished")
    await h.finished
  })

  it("pause freezes progress; resume continues", () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(40)
    env.tick()
    h.pause()
    env.advance(1000)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0.4, 5)
    h.resume()
    env.advance(60)
    env.tick()
    expect(el.styles.get("opacity")).toBe("1")
  })

  it("seek jumps to an arbitrary progress and renders immediately", () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    h.pause()
    h.seek(0.75)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0.75, 5)
  })

  it("cancel rejects the finished promise and stops ticking", async () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    h.cancel()
    expect(h.state).toBe("cancelled")
    await expect(h.finished).rejects.toThrow(/cancelled/)
    // Scheduler should have no more pending keepalive work from us.
    expect(env.scheduler.isRunning).toBe(false)
  })

  it("calls onFinish when animation completes", async () => {
    const el = makeEl()
    const env = setup()
    let finished = false
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 50 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
      onFinish: () => {
        finished = true
      },
    })
    env.tick()
    env.advance(60)
    env.tick()
    await h.finished
    expect(finished).toBe(true)
  })

  it("applies to multiple targets in one pass", () => {
    const a = makeEl()
    const b = makeEl()
    const env = setup()
    playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [a, b], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(50)
    env.tick()
    expect(a.styles.get("opacity")).toBe(b.styles.get("opacity"))
  })

  it("reverse flips direction and rewinds back to progress 0", async () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(60)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0.6, 5)
    h.reverse()
    expect(h.direction).toBe(-1)
    env.advance(60)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0, 5)
    expect(h.state).toBe("finished")
    await h.finished
  })

  it("setSpeed changes the rate of progress without losing position", () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(40)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0.4, 5)
    h.setSpeed(2)
    env.advance(30)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(1, 5)
    expect(h.state).toBe("finished")
  })

  it("reverse from a finished state replays backwards to the start", async () => {
    const el = makeEl()
    const env = setup()
    const h = playRaf(tween({ opacity: [0, 1] }, { duration: 100 }), [el], {
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(110)
    env.tick()
    expect(h.state).toBe("finished")
    h.reverse()
    expect(h.state).toBe("playing")
    env.advance(100)
    env.tick()
    expect(Number(el.styles.get("opacity"))).toBeCloseTo(0, 5)
    await h.finished
  })

  it("rejects animations with non-finite duration", () => {
    const el = makeEl()
    const env = setup()
    expect(() =>
      playRaf(
        { interpolate: () => ({}), duration: Number.POSITIVE_INFINITY, easing: (p) => p },
        [el],
        {
          scheduler: env.scheduler,
          clock: env.clock,
        },
      ),
    ).toThrow()
  })
})
