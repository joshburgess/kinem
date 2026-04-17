import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import type { StrategyTarget } from "../render/strategy"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import type { ScrollRect, ScrollSource } from "./source"
import { playScrollSync } from "./sync"

function makeTarget(rect: ScrollRect): StrategyTarget & {
  rect: ScrollRect
  styles: Map<string, string>
} {
  const styles = new Map<string, string>()
  return {
    rect,
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
    hasScrollListener: () => scrollCbs.size > 0,
    hasResizeListener: () => resizeCbs.size > 0,
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
  const now = 0
  const scheduler = createFrameScheduler({ raf, now: () => now })
  return {
    scheduler,
    tick() {
      const entries = [...pending]
      pending.clear()
      for (const [, cb] of entries) cb(now)
    },
  }
}

describe("playScrollSync", () => {
  it("applies interpolated values on scroll", () => {
    const src = makeSource()
    const el = makeTarget({ top: 1000, height: 400 })
    src.setRect(el, { top: 1000, height: 400 })
    const env = setup()

    const handle = playScrollSync(tween({ width: ["0px", "100px"] }, { duration: 1000 }), [el], {
      source: src.source,
      start: { element: 0, viewport: 0.8 },
      end: { element: 1, viewport: 0.2 },
      scheduler: env.scheduler,
    })

    env.tick()
    expect(el.styles.get("width")).toBe("0px")
    expect(handle.progress).toBe(0)

    src.setScroll(900)
    env.tick()
    expect(handle.progress).toBeGreaterThan(0)
    expect(handle.progress).toBeLessThan(1)

    src.setScroll(2000)
    env.tick()
    expect(el.styles.get("width")).toBe("100px")
    expect(handle.progress).toBe(1)
  })

  it("coalesces rapid scroll events into a single render", () => {
    const src = makeSource()
    const el = makeTarget({ top: 0, height: 100 })
    src.setRect(el, { top: 0, height: 100 })
    const env = setup()

    let renders = 0
    playScrollSync(tween({ width: ["0px", "100px"] }, { duration: 100 }), [el], {
      source: src.source,
      start: { element: 0, viewport: 0 },
      end: { element: 1, viewport: 0 },
      scheduler: env.scheduler,
      onProgress: () => {
        renders++
      },
    })

    env.tick()
    expect(renders).toBe(1)

    src.setScroll(10)
    src.setScroll(20)
    src.setScroll(30)
    env.tick()
    expect(renders).toBe(2)
  })

  it("re-measures on resize", () => {
    const src = makeSource()
    const el = makeTarget({ top: 0, height: 100 })
    src.setRect(el, { top: 0, height: 100 })
    const env = setup()

    const handle = playScrollSync(tween({ width: ["0px", "100px"] }, { duration: 100 }), [el], {
      source: src.source,
      start: { element: 0, viewport: 0 },
      end: { element: 1, viewport: 0 },
      scheduler: env.scheduler,
    })
    env.tick()

    src.setScroll(50)
    env.tick()
    expect(handle.progress).toBeCloseTo(0.5, 5)

    src.setRect(el, { top: 0, height: 200 })
    src.setViewport(800)
    env.tick()
    expect(handle.progress).toBeCloseTo(0.25, 5)
  })

  it("cancel unsubscribes and stops rendering", () => {
    const src = makeSource()
    const el = makeTarget({ top: 0, height: 100 })
    src.setRect(el, { top: 0, height: 100 })
    const env = setup()

    const handle = playScrollSync(tween({ width: ["0px", "100px"] }, { duration: 100 }), [el], {
      source: src.source,
      start: { element: 0, viewport: 0 },
      end: { element: 1, viewport: 0 },
      scheduler: env.scheduler,
    })
    env.tick()
    expect(src.hasScrollListener()).toBe(true)
    expect(src.hasResizeListener()).toBe(true)

    handle.cancel()
    expect(handle.state).toBe("cancelled")
    expect(src.hasScrollListener()).toBe(false)
    expect(src.hasResizeListener()).toBe(false)

    src.setScroll(9999)
    env.tick()
    expect(el.styles.get("width")).toBe("0px")
  })
})
