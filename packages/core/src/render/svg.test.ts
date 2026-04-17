import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import type { StrategyTarget } from "./strategy"
import { strokeDraw } from "./svg"

function svgTarget(): StrategyTarget & {
  attrs: Map<string, string>
} {
  const attrs = new Map<string, string>()
  return {
    attrs,
    style: { setProperty() {} },
    setAttribute(name: string, value: string) {
      attrs.set(name, value)
    },
    animate() {
      return {
        pause() {},
        play() {},
        cancel() {},
        finish() {},
        reverse() {},
        currentTime: 0,
        playbackRate: 1,
        finished: Promise.resolve(),
        onfinish: null,
        oncancel: null,
      }
    },
  } as unknown as StrategyTarget & { attrs: Map<string, string> }
}

describe("svg attribute animation", () => {
  it("tween `d` matches the path interpolator and emits path strings", () => {
    const def = tween({ d: ["M0 0 L10 0", "M0 0 L20 0"] }, { duration: 100 })
    const mid = def.interpolate(0.5) as { d: string }
    expect(typeof mid.d).toBe("string")
    // linear halfway between 10 and 20 is 15
    expect(mid.d).toContain("15")
  })

  it("tween `cx`/`cy`/`r` interpolates numbers", () => {
    const def = tween({ cx: [0, 100], cy: [0, 50], r: [5, 15] }, { duration: 100 })
    const mid = def.interpolate(0.5) as { cx: number; cy: number; r: number }
    expect(mid.cx).toBe(50)
    expect(mid.cy).toBe(25)
    expect(mid.r).toBe(10)
  })

  it("strokeDraw defaults draw the stroke from fully offset to zero", () => {
    const def = strokeDraw({ pathLength: 100 })
    const start = def.interpolate(0) as { strokeDasharray: number; strokeDashoffset: number }
    const end = def.interpolate(1) as { strokeDasharray: number; strokeDashoffset: number }
    expect(start.strokeDasharray).toBe(100)
    expect(start.strokeDashoffset).toBe(100)
    expect(end.strokeDashoffset).toBe(0)
  })

  it("strokeDraw(reverse:true) retracts the stroke back", () => {
    const def = strokeDraw({ pathLength: 60, reverse: true })
    const start = def.interpolate(0) as { strokeDashoffset: number }
    const end = def.interpolate(1) as { strokeDashoffset: number }
    expect(start.strokeDashoffset).toBe(0)
    expect(end.strokeDashoffset).toBe(60)
  })

  it("strokeDraw honors a custom duration", () => {
    const def = strokeDraw({ pathLength: 100, duration: 1234 })
    expect(def.duration).toBe(1234)
  })
})
