import { describe, expect, it } from "vitest"
import { createPresence } from "./presence"

function snapshot<T>(store: { subscribe(fn: (v: T) => void): () => void }): T {
  let v: T | undefined
  const u = store.subscribe((x) => {
    v = x
  })
  u()
  return v as T
}

describe("createPresence (svelte)", () => {
  it("starts present + rendering by default", () => {
    const p = createPresence()
    expect(snapshot(p.isPresent)).toBe(true)
    expect(snapshot(p.shouldRender)).toBe(true)
  })

  it("update(false) flips isPresent but keeps shouldRender true until safeToRemove", () => {
    const p = createPresence()
    p.update(false)
    expect(snapshot(p.isPresent)).toBe(false)
    expect(snapshot(p.shouldRender)).toBe(true)
    p.safeToRemove()
    expect(snapshot(p.shouldRender)).toBe(false)
  })

  it("update(true) after safeToRemove resets the latch and re-arms shouldRender", () => {
    const p = createPresence()
    p.update(false)
    p.safeToRemove()
    expect(snapshot(p.shouldRender)).toBe(false)

    p.update(true)
    expect(snapshot(p.isPresent)).toBe(true)
    expect(snapshot(p.shouldRender)).toBe(true)

    // A subsequent exit cycle should defer again.
    p.update(false)
    expect(snapshot(p.shouldRender)).toBe(true)
    p.safeToRemove()
    expect(snapshot(p.shouldRender)).toBe(false)
  })

  it("notifies subscribers when shouldRender changes", () => {
    const p = createPresence()
    const seen: boolean[] = []
    const unsub = p.shouldRender.subscribe((v) => seen.push(v))
    p.update(false)
    p.safeToRemove()
    p.update(true)
    p.update(false)
    p.safeToRemove()
    unsub()
    // initial true (immediate), no change at update(false) (still true),
    // false at safeToRemove, true at update(true), no change at
    // update(false), false at second safeToRemove
    expect(seen).toEqual([true, false, true, false])
  })

  it("respects initial=false", () => {
    const p = createPresence({ initial: false })
    expect(snapshot(p.isPresent)).toBe(false)
    expect(snapshot(p.shouldRender)).toBe(true)
    p.safeToRemove()
    expect(snapshot(p.shouldRender)).toBe(false)
  })
})
