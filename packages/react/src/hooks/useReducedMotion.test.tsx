// @vitest-environment happy-dom

import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useReducedMotion } from "./useReducedMotion"

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

function Probe({ onValue }: { onValue: (v: boolean) => void }): null {
  const v = useReducedMotion()
  onValue(v)
  return null
}

describe("useReducedMotion (react)", () => {
  it("returns false initially when matchMedia reports false", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const seen: boolean[] = []
    render(<Probe onValue={(v) => seen.push(v)} />)
    expect(seen.at(-1)).toBe(false)
  })

  it("returns true when matchMedia matches", () => {
    const mql = makeFakeMql(true)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const seen: boolean[] = []
    render(<Probe onValue={(v) => seen.push(v)} />)
    expect(seen.at(-1)).toBe(true)
  })

  it("re-renders when the media query flips", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const seen: boolean[] = []
    render(<Probe onValue={(v) => seen.push(v)} />)
    expect(seen.at(-1)).toBe(false)
    act(() => mql.fire(true))
    expect(seen.at(-1)).toBe(true)
  })

  it("removes the listener on unmount", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const r = render(<Probe onValue={() => {}} />)
    expect(mql.listeners.size).toBe(1)
    r.unmount()
    expect(mql.listeners.size).toBe(0)
  })

  it("returns false safely when matchMedia is unavailable", () => {
    ;(window as unknown as { matchMedia?: unknown }).matchMedia = undefined
    const seen: boolean[] = []
    render(<Probe onValue={(v) => seen.push(v)} />)
    expect(seen.at(-1)).toBe(false)
  })
})
