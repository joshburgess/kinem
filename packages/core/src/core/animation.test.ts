import { describe, expect, it } from "vitest"
import { animation, delay, loop, map, parallel, reverse, sequence, stagger } from "./animation"
import { easeIn, easeOut, linear } from "./easing"
import type { AnimationDef } from "./types"

const lerp = (from: number, to: number): ((p: number) => number) => {
  return (p) => from + (to - from) * p
}

const tween = (from: number, to: number, duration: number, ease = linear): AnimationDef<number> =>
  animation(lerp(from, to), duration, ease)

describe("animation combinators", () => {
  describe("animation()", () => {
    it("applies easing and clamps progress", () => {
      const a = tween(0, 100, 500, linear)
      expect(a.interpolate(0)).toBe(0)
      expect(a.interpolate(0.5)).toBe(50)
      expect(a.interpolate(1)).toBe(100)
      expect(a.interpolate(-0.1)).toBe(0)
      expect(a.interpolate(1.5)).toBe(100)
    })

    it("carries duration and easing through", () => {
      const a = tween(0, 100, 500, easeIn)
      expect(a.duration).toBe(500)
      expect(a.easing).toBe(easeIn)
    })
  })

  describe("sequence()", () => {
    it("sums durations", () => {
      const s = sequence(tween(0, 1, 100), tween(1, 2, 200))
      expect(s.duration).toBe(300)
    })

    it("at t=0 plays start of first child", () => {
      const s = sequence(tween(0, 1, 100), tween(10, 20, 200))
      expect(s.interpolate(0)).toBe(0)
    })

    it("at t=1 plays end of last child", () => {
      const s = sequence(tween(0, 1, 100), tween(10, 20, 200))
      expect(s.interpolate(1)).toBe(20)
    })

    it("at the boundary, transitions to the next child", () => {
      const a = tween(0, 1, 100)
      const b = tween(10, 20, 100)
      const s = sequence(a, b)
      // at p=0.5, t = 100 (boundary). b.interpolate(0) = 10.
      expect(s.interpolate(0.5)).toBe(10)
    })

    it("single child returns the child unchanged", () => {
      const a = tween(0, 1, 100)
      expect(sequence(a)).toBe(a)
    })

    it("throws on empty input", () => {
      expect(() => sequence()).toThrow()
    })
  })

  describe("parallel()", () => {
    it("duration is the max of children", () => {
      const p = parallel(tween(0, 1, 100), tween(0, 1, 300), tween(0, 1, 200))
      expect(p.duration).toBe(300)
    })

    it("evaluates children at their own clamped progress", () => {
      // a runs 100ms ending at 10; b runs 200ms ending at 20.
      const a = tween(0, 10, 100)
      const b = tween(0, 20, 200)
      const p = parallel(a, b)
      // at global p=0.5 (t=100), a finished (-> 10), b halfway (-> 10).
      const r = p.interpolate(0.5)
      expect(r[0]).toBeCloseTo(10, 10)
      expect(r[1]).toBeCloseTo(10, 10)
      // at p=1: [10, 20]
      const end = p.interpolate(1)
      expect(end[0]).toBeCloseTo(10, 10)
      expect(end[1]).toBeCloseTo(20, 10)
    })

    it("produces tuple-shaped output for heterogeneous types", () => {
      const a = tween(0, 1, 100)
      const b = animation<string>((p) => `v=${p}`, 100)
      const p = parallel(a, b)
      const r = p.interpolate(1)
      expect(r).toHaveLength(2)
      expect(typeof r[0]).toBe("number")
      expect(typeof r[1]).toBe("string")
    })

    it("throws on empty input", () => {
      expect(() => parallel()).toThrow()
    })
  })

  describe("stagger()", () => {
    it("count=1 produces a single-element array with no extra duration", () => {
      const a = tween(0, 1, 100)
      const s = stagger(a, { each: 50, count: 1 })
      expect(s.duration).toBe(100)
      expect(s.interpolate(1)).toEqual([1])
    })

    it("from: start delays children linearly", () => {
      const a = tween(0, 1, 100)
      const s = stagger(a, { each: 100, count: 3, from: "start" })
      // total = (3-1)*100 + 100 = 300
      expect(s.duration).toBe(300)
      // at p=1, all children should be at 1.
      expect(s.interpolate(1)).toEqual([1, 1, 1])
      // at p=0, only child 0 is at start (0), others are still waiting (also 0).
      expect(s.interpolate(0)).toEqual([0, 0, 0])
    })

    it("from: end reverses the order", () => {
      const a = tween(0, 1, 100)
      const s = stagger(a, { each: 100, count: 3, from: "end" })
      // at t=0, child 2 (end) starts first.
      // total = 300. at p = 0.5 (t=150), child 2 has t=150, clamped to end -> 1.
      const r = s.interpolate(0.5)
      expect(r[2]).toBe(1)
      expect(r[0]).toBe(0)
    })

    it("from: center radiates outward", () => {
      const a = tween(0, 10, 100)
      const s = stagger(a, { each: 100, count: 5, from: "center" })
      // mid index is 2. delays = |i-2|*100 = [200, 100, 0, 100, 200]
      // total = 200 + 100 = 300
      expect(s.duration).toBe(300)
      // at p=0, only index 2 starts (value 0), but since all start at 0, all 0.
      // at t just after 0, only index 2 has progress.
    })

    it("rejects count < 1", () => {
      expect(() => stagger(tween(0, 1, 100), { each: 50, count: 0 })).toThrow()
    })
  })

  describe("loop()", () => {
    it("count=1 returns the input unchanged", () => {
      const a = tween(0, 1, 100)
      expect(loop(a, 1)).toBe(a)
    })

    it("count=2 doubles duration and replays", () => {
      const a = tween(0, 10, 100)
      const l = loop(a, 2)
      expect(l.duration).toBe(200)
      // at p=0, value is 0
      expect(l.interpolate(0)).toBe(0)
      // at p=0.25, first cycle at 50% -> 5
      expect(l.interpolate(0.25)).toBeCloseTo(5, 10)
      // at p=0.5, boundary. fraction = 0 -> start of second cycle -> 0
      expect(l.interpolate(0.5)).toBe(0)
      // at p=0.75, second cycle at 50% -> 5
      expect(l.interpolate(0.75)).toBeCloseTo(5, 10)
      // at p=1, end of last cycle -> 10
      expect(l.interpolate(1)).toBe(10)
    })

    it("rejects Infinity", () => {
      expect(() => loop(tween(0, 1, 100), Number.POSITIVE_INFINITY)).toThrow()
    })

    it("rejects count < 1", () => {
      expect(() => loop(tween(0, 1, 100), 0)).toThrow()
    })
  })

  describe("delay()", () => {
    it("zero delay is identity", () => {
      const a = tween(0, 10, 100)
      expect(delay(a, 0)).toBe(a)
    })

    it("adds leading no-op time", () => {
      const a = tween(0, 10, 100)
      const d = delay(a, 100)
      expect(d.duration).toBe(200)
      // first half is hold at start
      expect(d.interpolate(0)).toBe(0)
      expect(d.interpolate(0.49)).toBe(0)
      // at p=0.5 (boundary), we hit the condition t <= ms -> still 0
      expect(d.interpolate(0.5)).toBe(0)
      // second half plays the animation
      expect(d.interpolate(0.75)).toBeCloseTo(5, 10)
      expect(d.interpolate(1)).toBe(10)
    })

    it("rejects negative delay", () => {
      expect(() => delay(tween(0, 1, 100), -1)).toThrow()
    })
  })

  describe("reverse()", () => {
    it("swaps start and end values", () => {
      const a = tween(0, 10, 100)
      const r = reverse(a)
      expect(r.interpolate(0)).toBe(10)
      expect(r.interpolate(1)).toBe(0)
      expect(r.interpolate(0.5)).toBeCloseTo(5, 10)
    })

    it("reverse(reverse(x)) equals x at all sampled points", () => {
      const a = tween(3, 7, 100, easeOut)
      const rr = reverse(reverse(a))
      for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        expect(rr.interpolate(p)).toBeCloseTo(a.interpolate(p), 10)
      }
    })

    it("preserves duration", () => {
      const a = tween(0, 1, 500)
      expect(reverse(a).duration).toBe(500)
    })
  })

  describe("map()", () => {
    it("transforms values without changing timing", () => {
      const a = tween(0, 10, 100)
      const m = map(a, (v) => `${v}px`)
      expect(m.duration).toBe(100)
      expect(m.interpolate(0)).toBe("0px")
      expect(m.interpolate(1)).toBe("10px")
      expect(m.interpolate(0.5)).toBe("5px")
    })

    it("preserves easing reference", () => {
      const a = tween(0, 1, 100, easeIn)
      const m = map(a, (v) => v)
      expect(m.easing).toBe(easeIn)
    })
  })

  describe("composition laws", () => {
    it("sequence is associative at sampled points", () => {
      const a = tween(0, 1, 100)
      const b = tween(1, 2, 100)
      const c = tween(2, 3, 100)
      const left = sequence(sequence(a, b), c)
      const right = sequence(a, sequence(b, c))
      for (const p of [0, 0.1, 0.33, 0.5, 0.66, 0.9, 1]) {
        expect(left.interpolate(p)).toBeCloseTo(right.interpolate(p), 10)
      }
    })
  })
})
