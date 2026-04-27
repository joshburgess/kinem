// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReducedMotionStore } from "./reduced-motion"

interface FakeMql {
  matches: boolean
  listeners: Set<(e: MediaQueryListEvent) => void>
  addEventListener(type: "change", cb: (e: MediaQueryListEvent) => void): void
  removeEventListener(type: "change", cb: (e: MediaQueryListEvent) => void): void
  fire(matches: boolean): void
}

function makeFakeMql(initial: boolean): FakeMql {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql: FakeMql = {
    matches: initial,
    listeners,
    addEventListener(_type, cb) {
      listeners.add(cb)
    },
    removeEventListener(_type, cb) {
      listeners.delete(cb)
    },
    fire(matches: boolean) {
      mql.matches = matches
      for (const cb of listeners) cb({ matches } as MediaQueryListEvent)
    },
  }
  return mql
}

let originalMatchMedia: typeof window.matchMedia | undefined

beforeEach(() => {
  originalMatchMedia = window.matchMedia
})

afterEach(() => {
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia
  }
})

describe("reducedMotion store (svelte)", () => {
  it("emits the current matchMedia state on subscribe", () => {
    const mql = makeFakeMql(true)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const store = createReducedMotionStore()
    const seen: boolean[] = []
    const unsub = store.subscribe((v) => seen.push(v))
    expect(seen.at(-1)).toBe(true)
    unsub()
  })

  it("emits new values when the media query flips", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const store = createReducedMotionStore()
    const seen: boolean[] = []
    const unsub = store.subscribe((v) => seen.push(v))
    expect(seen.at(-1)).toBe(false)
    mql.fire(true)
    expect(seen.at(-1)).toBe(true)
    mql.fire(false)
    expect(seen.at(-1)).toBe(false)
    unsub()
  })

  it("attaches one MQL listener regardless of subscriber count", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const store = createReducedMotionStore()
    const u1 = store.subscribe(() => {})
    const u2 = store.subscribe(() => {})
    expect(mql.listeners.size).toBe(1)
    u1()
    expect(mql.listeners.size).toBe(1)
    u2()
    expect(mql.listeners.size).toBe(0)
  })

  it("emits false safely when matchMedia is unavailable", () => {
    ;(window as unknown as { matchMedia?: unknown }).matchMedia = undefined
    const store = createReducedMotionStore()
    const seen: boolean[] = []
    store.subscribe((v) => seen.push(v))
    expect(seen.at(-1)).toBe(false)
  })
})
