import { describe, expect, it } from "vitest"
import type { StrategyTarget } from "../render/strategy"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import { timeline } from "./timeline"
import { tween } from "./tween"

function makeTarget(): StrategyTarget & { styles: Map<string, string> } {
  const styles = new Map<string, string>()
  return {
    styles,
    style: {
      setProperty(name, value) {
        styles.set(name, value)
      },
    },
    setAttribute() {},
    animate() {
      throw new Error("WAAPI not used in this test")
    },
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
      const entries = [...pending]
      pending.clear()
      for (const [, cb] of entries) cb(time)
    },
  }
}

function setup() {
  const r = makeRaf()
  let now = 0
  const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
  const clock = createClock({ now: () => now })
  return {
    scheduler,
    clock,
    raf: r,
    advance(ms: number) {
      now += ms
    },
    tick() {
      r.fire(now)
    },
  }
}

describe("timeline", () => {
  it("sequences two animations back-to-back by default (at: '>')", async () => {
    const a = makeTarget()
    const b = makeTarget()
    const env = setup()
    const tl = timeline()
      .add(tween({ width: ["0px", "100px"] }, { duration: 100 }), a)
      .add(tween({ width: ["0px", "100px"] }, { duration: 100 }), b)

    expect(tl.duration).toBe(200)

    const controls = tl.play({
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })

    env.tick()
    expect(a.styles.get("width")).toBe("0px")
    expect(b.styles.get("width")).toBe("0px")

    env.advance(100)
    env.tick()
    expect(a.styles.get("width")).toBe("100px")
    expect(b.styles.get("width")).toBe("0px")

    env.advance(100)
    env.tick()
    expect(a.styles.get("width")).toBe("100px")
    expect(b.styles.get("width")).toBe("100px")

    await controls
    expect(controls.state).toBe("finished")
  })

  it("overlaps with at: '<' (start-of-previous)", () => {
    const a = makeTarget()
    const b = makeTarget()
    const env = setup()
    const tl = timeline()
      .add(tween({ width: ["0px", "100px"] }, { duration: 100 }), a)
      .add(tween({ opacity: [0, 1] }, { duration: 100 }), b, { at: "<" })

    expect(tl.duration).toBe(100)

    tl.play({ waapiSupported: false, scheduler: env.scheduler, clock: env.clock })
    env.tick()
    env.advance(50)
    env.tick()
    expect(a.styles.get("width")).toBe("50px")
    expect(b.styles.get("opacity")).toBe("0.5")
  })

  it("places at an absolute ms position", () => {
    const a = makeTarget()
    const env = setup()
    timeline()
      .add(tween({ width: ["0px", "100px"] }, { duration: 100 }), a, { at: 50 })
      .play({ waapiSupported: false, scheduler: env.scheduler, clock: env.clock })
    env.tick()
    expect(a.styles.get("width")).toBe("0px")
    env.advance(50)
    env.tick()
    expect(a.styles.get("width")).toBe("0px")
    env.advance(50)
    env.tick()
    expect(a.styles.get("width")).toBe("50px")
  })

  it("resolves a label via at: 'name' and supports offsets", () => {
    const a = makeTarget()
    const b = makeTarget()
    const env = setup()
    const tl = timeline()
      .add(tween({ width: ["0px", "100px"] }, { duration: 100 }), a, { label: "intro" })
      .add(tween({ opacity: [0, 1] }, { duration: 100 }), b, { at: "intro", offset: 50 })

    expect(tl.duration).toBe(150)
    expect(tl.labels.get("intro")).toBe(0)

    tl.play({ waapiSupported: false, scheduler: env.scheduler, clock: env.clock })
    env.tick()
    env.advance(50)
    env.tick()
    expect(a.styles.get("width")).toBe("50px")
    expect(b.styles.get("opacity")).toBe("0")
  })

  it("seekLabel jumps the combined handle to the label's progress", () => {
    const a = makeTarget()
    const b = makeTarget()
    const env = setup()
    const controls = timeline()
      .add(tween({ width: ["0px", "100px"] }, { duration: 100 }), a)
      .addLabel("mid")
      .add(tween({ opacity: [0, 1] }, { duration: 100 }), b)
      .play({ waapiSupported: false, scheduler: env.scheduler, clock: env.clock })

    env.tick()
    controls.pause()
    controls.seekLabel("mid")
    env.tick()
    expect(a.styles.get("width")).toBe("100px")
    expect(b.styles.get("opacity")).toBe("0")
  })

  it("addLabel throws on unknown reference", () => {
    expect(() => timeline().addLabel("x", "missing")).toThrow(/unknown label/)
  })

  it("is awaitable and resolves on completion", async () => {
    const a = makeTarget()
    const env = setup()
    const controls = timeline()
      .add(tween({ width: ["0px", "50px"] }, { duration: 50 }), a)
      .play({ waapiSupported: false, scheduler: env.scheduler, clock: env.clock })

    env.tick()
    env.advance(60)
    env.tick()
    await controls
    expect(a.styles.get("width")).toBe("50px")
    expect(controls.state).toBe("finished")
  })

  it("returns a zero-duration Controls when the timeline is empty", async () => {
    const controls = timeline().play({ waapiSupported: false })
    expect(controls.duration).toBe(0)
    expect(controls.state).toBe("finished")
    await controls
  })
})
