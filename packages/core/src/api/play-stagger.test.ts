import { describe, expect, it } from "vitest"
import { playStagger } from "./play-stagger"
import { tween } from "./tween"

interface FakeTarget {
  style: { setProperty(name: string, value: string): void }
  setAttribute(name: string, value: string): void
  written: Record<string, string>
}

const mkTarget = (): FakeTarget => {
  const t: FakeTarget = {
    written: {},
    style: {
      setProperty(name, value) {
        t.written[name] = value
      },
    },
    setAttribute(name, value) {
      t.written[name] = value
    },
  }
  return t
}

describe("playStagger", () => {
  it("returns Controls with duration = max child duration", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget()]
    const def = tween({ opacity: [0, 1] }, { duration: 400 })
    const h = playStagger(def, targets as never, {
      each: 50,
      backend: "raf",
      lazy: false,
    })
    // 3 targets, each = 50: orders = 0, 1, 2 -> delays 0, 50, 100 -> totalDuration max = 400 + 100 = 500
    expect(h.duration).toBe(500)
    h.cancel()
  })

  it("an empty target list yields Controls of duration 0", () => {
    const def = tween({ opacity: [0, 1] }, { duration: 400 })
    const h = playStagger(def, [] as never, { each: 40, backend: "raf", lazy: false })
    expect(h.duration).toBe(0)
    h.cancel()
  })

  it("a single target degenerates to the def's own duration", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] }, { duration: 300 })
    const h = playStagger(def, [target] as never, { each: 40, backend: "raf", lazy: false })
    expect(h.duration).toBe(300)
    h.cancel()
  })

  it("from: 'end' reverses ordering — last target starts at offset 0", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget()]
    const def = tween({ opacity: [0, 1] }, { duration: 400 })
    const h = playStagger(def, targets as never, {
      each: 50,
      from: "end",
      backend: "raf",
      lazy: false,
    })
    // Orders: 2, 1, 0 -> shifted: 2, 1, 0 -> delays 100, 50, 0 -> max child duration 500
    expect(h.duration).toBe(500)
    h.cancel()
  })

  it("from: 'center' staggers outward from the middle", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget(), mkTarget(), mkTarget()]
    const def = tween({ opacity: [0, 1] }, { duration: 200 })
    const h = playStagger(def, targets as never, {
      each: 100,
      from: "center",
      backend: "raf",
      lazy: false,
    })
    // 5 targets, mid=2; orders: |0-2|, |1-2|, 0, |3-2|, |4-2| = 2, 1, 0, 1, 2
    // shifted (min=0) -> delays 200, 100, 0, 100, 200; max = 200 + 200 = 400
    expect(h.duration).toBe(400)
    h.cancel()
  })

  it("from: function delegates per-index ordering", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget()]
    const def = tween({ opacity: [0, 1] }, { duration: 100 })
    const h = playStagger(def, targets as never, {
      each: 50,
      from: (i) => (i === 0 ? 5 : 0),
      backend: "raf",
      lazy: false,
    })
    // orders: 5, 0, 0 -> shifted (min=0) -> delays 250, 0, 0 -> max child 100 + 250 = 350
    expect(h.duration).toBe(350)
    h.cancel()
  })

  it("each = 0 makes every target start simultaneously", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget()]
    const def = tween({ opacity: [0, 1] }, { duration: 250 })
    const h = playStagger(def, targets as never, { each: 0, backend: "raf", lazy: false })
    expect(h.duration).toBe(250)
    h.cancel()
  })
})
