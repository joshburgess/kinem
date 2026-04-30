import { describe, expect, it } from "vitest"
import { motionValueEvent } from "./event"
import { motionValue } from "./motion-value"

describe("motionValueEvent()", () => {
  it("forwards change notifications", () => {
    const x = motionValue(0)
    const seen: number[] = []
    motionValueEvent(x, "change", (v) => seen.push(v))
    x.set(1)
    x.set(2)
    expect(seen).toEqual([1, 2])
  })

  it("returns an unsubscribe function", () => {
    const x = motionValue(0)
    let calls = 0
    const off = motionValueEvent(x, "change", () => {
      calls++
    })
    x.set(1)
    off()
    x.set(2)
    expect(calls).toBe(1)
  })

  it("throws on an unknown event name", () => {
    const x = motionValue(0)
    expect(() => motionValueEvent(x, "bogus" as "change", () => {})).toThrow(/unsupported event/)
  })
})
