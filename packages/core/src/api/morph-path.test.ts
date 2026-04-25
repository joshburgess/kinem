import { describe, expect, it } from "vitest"
import { morphPath } from "./morph-path"

describe("morphPath", () => {
  it("at progress 0, output is close to the from-path's polyline", () => {
    const from = "M 0 0 L 100 0 L 100 100 L 0 100"
    const to = "M 50 50 L 150 50 L 150 150 L 50 150"
    const m = morphPath(from, to, { samples: 32 })
    const v = m.interpolate(0)
    // First polyline point should match the start of `from`.
    const match = /^M\s+([\-\d\.]+)\s+([\-\d\.]+)/.exec(v.d)
    expect(Number(match?.[1])).toBeCloseTo(0, 5)
    expect(Number(match?.[2])).toBeCloseTo(0, 5)
  })

  it("at progress 1, output is close to the to-path's polyline", () => {
    const from = "M 0 0 L 100 0 L 100 100 L 0 100"
    const to = "M 50 50 L 150 50 L 150 150 L 50 150"
    const m = morphPath(from, to, { samples: 32 })
    const v = m.interpolate(1)
    const match = /^M\s+([\-\d\.]+)\s+([\-\d\.]+)/.exec(v.d)
    expect(Number(match?.[1])).toBeCloseTo(50, 5)
    expect(Number(match?.[2])).toBeCloseTo(50, 5)
  })

  it("midpoint is roughly the average of the endpoint polylines", () => {
    const from = "M 0 0 L 100 0"
    const to = "M 0 100 L 100 100"
    const m = morphPath(from, to, { samples: 4 })
    const v = m.interpolate(0.5)
    // Each y should be ~50
    const ys = Array.from(v.d.matchAll(/[\-\d\.]+\s+([\-\d\.]+)/g)).map((mm) => Number(mm[1]))
    for (const y of ys) {
      expect(y).toBeCloseTo(50, 1)
    }
  })

  it("works for paths with mismatched command counts", () => {
    const from = "M 0 0 L 100 0 L 100 100 L 0 100"
    const to = "M 50 0 C 50 -50 150 -50 150 0 C 150 50 50 50 50 0"
    expect(() => morphPath(from, to, { samples: 32 })).not.toThrow()
  })

  it("emits the d property in its output", () => {
    const m = morphPath("M 0 0 L 10 0", "M 0 10 L 10 10")
    expect(m.properties).toEqual(["d"])
    expect(m.interpolate(0.5).d.startsWith("M ")).toBe(true)
  })
})
