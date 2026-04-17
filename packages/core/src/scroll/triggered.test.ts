import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import type { StrategyTarget } from "../render/strategy"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import type { ScrollRect, ScrollSource } from "./source"
import { parseToggleActions, playScrollTriggered } from "./triggered"

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

function makeSource() {
  let scrollY = 0
  let vh = 800
  const scrollCbs = new Set<() => void>()
  const resizeCbs = new Set<() => void>()
  const rects = new WeakMap<StrategyTarget, ScrollRect>()

  const source: ScrollSource = {
    getScrollY: () => scrollY,
    getViewportHeight: () => vh,
    getRect(el) {
      return rects.get(el) ?? { top: 0, height: 0 }
    },
    onScroll(cb) {
      scrollCbs.add(cb)
      return () => scrollCbs.delete(cb)
    },
    onResize(cb) {
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
    setViewport(h: number) {
      vh = h
      for (const cb of resizeCbs) cb()
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

describe("parseToggleActions", () => {
  it("parses 4-word strings", () => {
    expect(parseToggleActions("play none none reverse")).toEqual([
      "play",
      "none",
      "none",
      "reverse",
    ])
  })

  it("passes tuples through", () => {
    const t = ["pause", "resume", "reverse", "reset"] as const
    expect(parseToggleActions(t)).toEqual(t)
  })

  it("rejects wrong-length strings", () => {
    expect(() => parseToggleActions("play none")).toThrow(/must have 4 entries/)
  })

  it("rejects unknown actions", () => {
    expect(() => parseToggleActions("play woof none none")).toThrow(/invalid toggle action/)
  })
})

describe("playScrollTriggered", () => {
  it("plays on onEnter and reverses on onLeaveBack (default toggleActions)", async () => {
    const src = makeSource()
    const el = makeTarget()
    src.setRect(el, { top: 1000, height: 100 })
    const env = setup()

    const handle = playScrollTriggered(
      tween({ width: ["0px", "100px"] }, { duration: 100 }),
      [el],
      {
        source: src.source,
        start: { element: 0, viewport: 1 },
        end: { element: 1, viewport: 0 },
        scheduler: env.scheduler,
        clock: env.clock,
        waapiSupported: false,
      },
    )
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
    expect(handle.state).toBe("idle")

    // Scroll into the active zone → onEnter → play
    src.setScroll(500)
    env.tick()
    expect(handle.state).toBe("active")

    env.advance(100)
    env.tick()
    expect(el.styles.get("width")).toBe("100px")

    // Keep scrolling: exit via onLeave → default "none" → stay at end
    src.setScroll(2000)
    env.tick()
    expect(el.styles.get("width")).toBe("100px")

    // Scroll back past start → onLeaveBack → reverse
    src.setScroll(0)
    env.advance(100)
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
  })

  it("respects a custom 'restart pause none reset' action string", () => {
    const src = makeSource()
    const el = makeTarget()
    src.setRect(el, { top: 1000, height: 100 })
    const env = setup()

    playScrollTriggered(tween({ width: ["0px", "100px"] }, { duration: 100 }), [el], {
      source: src.source,
      start: { element: 0, viewport: 1 },
      end: { element: 1, viewport: 0 },
      toggleActions: "restart pause none reset",
      scheduler: env.scheduler,
      clock: env.clock,
      waapiSupported: false,
    })
    env.tick()

    // Enter → restart
    src.setScroll(500)
    env.advance(50)
    env.tick()
    expect(el.styles.get("width")).toBe("50px")

    // Leave → pause
    src.setScroll(2000)
    env.advance(1000)
    env.tick()
    expect(el.styles.get("width")).toBe("50px")

    // LeaveBack (directly back to before via after → before) → fires enterBack then leaveBack.
    // enterBack = none, leaveBack = reset → pause + seek(0).
    src.setScroll(0)
    env.advance(100)
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
  })

  it("cancel stops the underlying animation and unsubscribes", () => {
    const src = makeSource()
    const el = makeTarget()
    src.setRect(el, { top: 1000, height: 100 })
    const env = setup()

    const handle = playScrollTriggered(
      tween({ width: ["0px", "100px"] }, { duration: 100 }),
      [el],
      {
        source: src.source,
        start: { element: 0, viewport: 1 },
        end: { element: 1, viewport: 0 },
        scheduler: env.scheduler,
        clock: env.clock,
        waapiSupported: false,
      },
    )
    env.tick()

    handle.cancel()
    expect(handle.state).toBe("cancelled")
    expect(handle.controls.state).toBe("cancelled")

    // Scroll has no effect after cancel.
    src.setScroll(500)
    env.advance(200)
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
  })
})
