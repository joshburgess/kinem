import { type Mock, describe, expect, it, vi } from "vitest"
import { createDomScrollSource } from "./source"

interface FakeWindow {
  scrollY: number
  innerHeight: number
  addEventListener: (type: string, cb: () => void, opts?: boolean | AddEventListenerOptions) => void
  removeEventListener: (type: string, cb: () => void) => void
}

function makeWin(): FakeWindow & {
  addEventListener: FakeWindow["addEventListener"] & Mock
  removeEventListener: FakeWindow["removeEventListener"] & Mock
} {
  return {
    scrollY: 0,
    innerHeight: 800,
    addEventListener: vi.fn() as FakeWindow["addEventListener"] & Mock,
    removeEventListener: vi.fn() as FakeWindow["removeEventListener"] & Mock,
  }
}

describe("createDomScrollSource", () => {
  it("reads scrollY and innerHeight from the window", () => {
    const w = makeWin()
    w.scrollY = 123
    const src = createDomScrollSource(w)
    expect(src.getScrollY()).toBe(123)
    expect(src.getViewportHeight()).toBe(800)
  })

  it("converts viewport-relative rect to document coordinates", () => {
    const w = makeWin()
    w.scrollY = 500
    const src = createDomScrollSource(w)
    const el = {
      getBoundingClientRect: () => ({ top: 100, height: 200 }),
    } as unknown as Parameters<typeof src.getRect>[0]
    expect(src.getRect(el)).toEqual({ top: 600, height: 200 })
  })

  it("returns zero rect when getBoundingClientRect is absent", () => {
    const w = makeWin()
    const src = createDomScrollSource(w)
    const el = {} as unknown as Parameters<typeof src.getRect>[0]
    expect(src.getRect(el)).toEqual({ top: 0, height: 0 })
  })

  it("binds scroll listener passively and unsubscribes cleanly", () => {
    const w = makeWin()
    const src = createDomScrollSource(w)
    const cb = vi.fn()
    const unsub = src.onScroll(cb)
    expect(w.addEventListener).toHaveBeenCalledWith("scroll", cb, { passive: true })
    unsub()
    expect(w.removeEventListener).toHaveBeenCalledWith("scroll", cb)
  })

  it("throws when no window is available", () => {
    expect(() => createDomScrollSource()).toThrow(/no window available/)
  })
})
