import { motionValue } from "@kinem/core"
import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createMotionValueEvent } from "./createMotionValueEvent"

describe("createMotionValueEvent (solid)", () => {
  it("fires the listener on every change", () => {
    const x = motionValue(0)
    const seen: number[] = []
    createRoot((dispose) => {
      createMotionValueEvent(x, "change", (v) => seen.push(v))
      x.set(1)
      x.set(2)
      x.set(3)
      dispose()
    })
    expect(seen).toEqual([1, 2, 3])
  })

  it("unsubscribes on dispose", () => {
    const x = motionValue(0)
    let calls = 0
    let dispose_: (() => void) | null = null
    createRoot((dispose) => {
      dispose_ = dispose
      createMotionValueEvent(x, "change", () => {
        calls++
      })
    })
    x.set(1)
    expect(calls).toBe(1)
    dispose_!()
    x.set(2)
    expect(calls).toBe(1)
  })
})
