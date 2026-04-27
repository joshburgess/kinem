// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type Ref, defineComponent, h, onMounted } from "vue"
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

function harness(onReady: (r: Ref<boolean>) => void): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup() {
      const r = useReducedMotion()
      onMounted(() => onReady(r))
      return () => h("div")
    },
  })
}

describe("useReducedMotion (vue)", () => {
  it("returns false initially when matchMedia reports false", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    let r: Ref<boolean> | undefined
    mount(
      harness((x) => {
        r = x
      }),
    )
    expect(r?.value).toBe(false)
  })

  it("returns true when matchMedia matches", () => {
    const mql = makeFakeMql(true)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    let r: Ref<boolean> | undefined
    mount(
      harness((x) => {
        r = x
      }),
    )
    expect(r?.value).toBe(true)
  })

  it("updates when the media query flips", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    let r: Ref<boolean> | undefined
    mount(
      harness((x) => {
        r = x
      }),
    )
    expect(r?.value).toBe(false)
    mql.fire(true)
    expect(r?.value).toBe(true)
  })

  it("removes the listener on unmount", () => {
    const mql = makeFakeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    const wrapper = mount(harness(() => {}))
    expect(mql.listeners.size).toBe(1)
    wrapper.unmount()
    expect(mql.listeners.size).toBe(0)
  })

  it("returns false safely when matchMedia is unavailable", () => {
    ;(window as unknown as { matchMedia?: unknown }).matchMedia = undefined
    let r: Ref<boolean> | undefined
    mount(
      harness((x) => {
        r = x
      }),
    )
    expect(r?.value).toBe(false)
  })
})
