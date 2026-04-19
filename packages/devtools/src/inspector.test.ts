import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { snapshot } from "./inspector"

import { __resetTracker, enableTracker, trackAnimation } from "kinem"

beforeEach(() => {
  // The devtools package entry enables the tracker as a side effect;
  // tests that import inspector directly bypass that, so enable here.
  enableTracker()
})

afterEach(() => {
  __resetTracker()
})

function pending(): Promise<void> {
  return new Promise<void>(() => {})
}

describe("inspector.snapshot", () => {
  it("returns an empty animations array with no tracked controls", () => {
    const snap = snapshot()
    expect(snap.animations).toHaveLength(0)
    expect(typeof snap.capturedAt).toBe("number")
  })

  it("reflects currently tracked animations", () => {
    trackAnimation(
      { state: "playing", duration: 500, finished: pending() } as never,
      [{ tagName: "DIV", id: "box", className: "a b" }] as never,
    )
    const snap = snapshot()
    expect(snap.animations).toHaveLength(1)
    const [a] = snap.animations
    if (!a) throw new Error("no animation")
    expect(a.state).toBe("playing")
    expect(a.duration).toBe(500)
    expect(a.targets[0]).toEqual({ kind: "element", tag: "div", id: "box", classes: ["a", "b"] })
  })

  it("produces JSON-serializable output", () => {
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "SPAN" }] as never,
    )
    const snap = snapshot()
    expect(() => JSON.stringify(snap)).not.toThrow()
  })

  it("describes non-element targets as `unknown`", () => {
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      ["not an element"] as never,
    )
    const snap = snapshot()
    expect(snap.animations[0]?.targets[0]).toEqual({ kind: "unknown" })
  })

  it("omits id and classes when not present", () => {
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "P" }] as never,
    )
    const snap = snapshot()
    expect(snap.animations[0]?.targets[0]).toEqual({ kind: "element", tag: "p" })
  })
})
