import { describe, expect, it } from "vitest"
import type { StrategyTarget } from "../render/strategy"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import type { ScrollRect, ScrollSource } from "../scroll/source"
import { scroll } from "./scroll"
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
      throw new Error("WAAPI not used")
    },
  }
}

function makeSource() {
  let scrollY = 0
  const vh = 800
  const scrollCbs = new Set<() => void>()
  const resizeCbs = new Set<() => void>()
  const rects = new WeakMap<StrategyTarget, ScrollRect>()
  const source: ScrollSource = {
    getScrollY: () => scrollY,
    getViewportHeight: () => vh,
    getRect: (el) => rects.get(el) ?? { top: 0, height: 0 },
    onScroll: (cb) => {
      scrollCbs.add(cb)
      return () => scrollCbs.delete(cb)
    },
    onResize: (cb) => {
      resizeCbs.add(cb)
      return () => resizeCbs.delete(cb)
    },
  }
  return {
    source,
    setRect(el: StrategyTarget, r: ScrollRect) {
      rects.set(el, r)
    },
    setScroll(y: number) {
      scrollY = y
      for (const cb of scrollCbs) cb()
    },
  }
}

function setup() {
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
  let now = 0
  const scheduler = createFrameScheduler({ raf, now: () => now })
  const clock = createClock({ now: () => now })
  return {
    scheduler,
    clock,
    advance(ms: number) {
      now += ms
    },
    tick() {
      const entries = [...pending]
      pending.clear()
      for (const [, cb] of entries) cb(now)
    },
  }
}

describe("scroll", () => {
  it("resolves a selector via opts.resolve and dispatches to sync mode", () => {
    const el = makeTarget()
    const src = makeSource()
    src.setRect(el, { top: 0, height: 100 })
    const env = setup()

    const handle = scroll(tween({ width: ["0px", "100px"] }, { duration: 100 }), ".bg", {
      sync: true,
      trigger: { start: "top top", end: "bottom top" },
      source: src.source,
      scheduler: env.scheduler,
      resolve: (sel) => {
        expect(sel).toBe(".bg")
        return [el]
      },
    })

    env.tick()
    expect(handle.state).toBe("active")
    src.setScroll(50)
    env.tick()
    expect(el.styles.get("width")).toBe("50px")
  })

  it("dispatches to triggered mode by default and plays on enter", () => {
    const el = makeTarget()
    const src = makeSource()
    src.setRect(el, { top: 1000, height: 100 })
    const env = setup()

    const handle = scroll(tween({ opacity: [0, 1] }, { duration: 100 }), el, {
      trigger: { start: "top bottom", end: "bottom top" },
      source: src.source,
      scheduler: env.scheduler,
      clock: env.clock,
      waapiSupported: false,
    })

    env.tick()
    expect(handle.state).toBe("idle")

    src.setScroll(500)
    env.advance(100)
    env.tick()
    expect(handle.state).toBe("active")
    expect(el.styles.get("opacity")).toBe("1")
  })
})
