import { describe, expect, it } from "vitest"
import type { StrategyTarget } from "../render/strategy"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import { play } from "./play"
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
      const entry = [...pending].at(-1)
      if (!entry) return
      const [id, cb] = entry
      pending.delete(id)
      cb(time)
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

describe("play", () => {
  it("accepts a single element", () => {
    const el = makeTarget()
    const env = setup()
    play(tween({ width: ["0px", "100px"] }, { duration: 100 }), el, {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
  })

  it("accepts an array of elements", () => {
    const a = makeTarget()
    const b = makeTarget()
    const env = setup()
    play(tween({ width: ["0px", "100px"] }, { duration: 100 }), [a, b], {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    expect(a.styles.get("width")).toBe("0px")
    expect(b.styles.get("width")).toBe("0px")
  })

  it("resolves a selector via opts.resolve", () => {
    const el = makeTarget()
    const env = setup()
    const controls = play(tween({ width: ["0px", "100px"] }, { duration: 100 }), ".foo", {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
      resolve: (sel) => {
        expect(sel).toBe(".foo")
        return [el]
      },
    })
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
    expect(controls.duration).toBe(100)
  })

  it("is awaitable via PromiseLike", async () => {
    const el = makeTarget()
    const env = setup()
    const controls = play(tween({ width: ["0px", "100px"] }, { duration: 50 }), el, {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(60)
    env.tick()
    await controls
    expect(el.styles.get("width")).toBe("100px")
    expect(controls.state).toBe("finished")
  })

  it("exposes a speed setter that propagates to the handle", () => {
    const el = makeTarget()
    const env = setup()
    const controls = play(tween({ width: ["0px", "100px"] }, { duration: 100 }), el, {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(40)
    env.tick()
    controls.speed = 2
    env.advance(30)
    env.tick()
    expect(el.styles.get("width")).toBe("100px")
  })

  it("reverse plays backwards from current progress", async () => {
    const el = makeTarget()
    const env = setup()
    const controls = play(tween({ width: ["0px", "100px"] }, { duration: 100 }), el, {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })
    env.tick()
    env.advance(60)
    env.tick()
    controls.reverse()
    env.advance(60)
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
    await controls
  })

  it("seekLabel throws on unknown labels", () => {
    const el = makeTarget()
    const env = setup()
    const controls = play(tween({ width: ["0px", "100px"] }, { duration: 100 }), el, {
      waapiSupported: false,
      scheduler: env.scheduler,
      clock: env.clock,
    })
    expect(() => controls.seekLabel("missing")).toThrow(/unknown label/)
  })

  describe("mode", () => {
    it("mode: 'main' routes compositor-safe props through rAF", () => {
      // The fake target throws on `animate()`, so if mode=main didn't
      // actually force rAF, opacity (compositor-safe) would hit WAAPI
      // and throw.
      const el = makeTarget()
      const env = setup()
      play(tween({ opacity: [0, 1] }, { duration: 100 }), el, {
        mode: "main",
        waapiSupported: true,
        scheduler: env.scheduler,
        clock: env.clock,
      })
      env.tick()
      expect(el.styles.get("opacity")).toBe("0")
    })

    it("mode: 'compositor' forces WAAPI even when the prop is main-tier", () => {
      // `width` is main-tier and would normally route to rAF. Forcing
      // compositor mode routes it to WAAPI, which trips the fake's
      // animate() throw. Disable lazy so the animate() call fires
      // synchronously inside play() rather than being deferred to a
      // scheduler tick (whose throw wouldn't surface to the caller).
      const el = makeTarget()
      const env = setup()
      expect(() =>
        play(tween({ width: ["0px", "100px"] }, { duration: 100 }), el, {
          mode: "compositor",
          lazy: false,
          waapiSupported: true,
          scheduler: env.scheduler,
          clock: env.clock,
        }),
      ).toThrow(/WAAPI not used/)
    })

    it("backend wins over mode when both are passed", () => {
      // backend=raf should override mode=compositor. Opacity would
      // otherwise hit WAAPI and throw; with rAF forced it writes style.
      const el = makeTarget()
      const env = setup()
      play(tween({ opacity: [0, 1] }, { duration: 100 }), el, {
        mode: "compositor",
        backend: "raf",
        waapiSupported: true,
        scheduler: env.scheduler,
        clock: env.clock,
      })
      env.tick()
      expect(el.styles.get("opacity")).toBe("0")
    })
  })
})
