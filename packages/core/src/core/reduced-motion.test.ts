// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tween } from "../api/tween"
import { playStrategy } from "../render/strategy"
import {
  getReducedMotionDefault,
  prefersReducedMotion,
  setReducedMotionDefault,
  shouldReduceMotion,
} from "./reduced-motion"

afterEach(() => {
  setReducedMotionDefault("never")
  vi.restoreAllMocks()
})

describe("setReducedMotionDefault / getReducedMotionDefault", () => {
  it("starts at 'never'", () => {
    expect(getReducedMotionDefault()).toBe("never")
  })

  it("round-trips set and get", () => {
    setReducedMotionDefault("user")
    expect(getReducedMotionDefault()).toBe("user")
    setReducedMotionDefault("always")
    expect(getReducedMotionDefault()).toBe("always")
  })
})

describe("prefersReducedMotion", () => {
  it("returns false when matchMedia reports no match", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList)
    expect(prefersReducedMotion()).toBe(false)
  })

  it("returns true when matchMedia reports the user has the pref", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList)
    expect(prefersReducedMotion()).toBe(true)
  })
})

describe("shouldReduceMotion", () => {
  it("'always' is true regardless of OS pref", () => {
    expect(shouldReduceMotion("always")).toBe(true)
  })
  it("'never' is false regardless of OS pref", () => {
    expect(shouldReduceMotion("never")).toBe(false)
  })
  it("'user' delegates to matchMedia", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList)
    expect(shouldReduceMotion("user")).toBe(true)
  })
  it("falls back to the global default when no arg is passed", () => {
    setReducedMotionDefault("always")
    expect(shouldReduceMotion()).toBe(true)
    setReducedMotionDefault("never")
    expect(shouldReduceMotion()).toBe(false)
  })
})

describe("playStrategy honours reducedMotion", () => {
  function mockTarget() {
    const styles = new Map<string, string>()
    return {
      styles,
      style: {
        setProperty(name: string, value: string) {
          styles.set(name, value)
        },
      },
      setAttribute() {},
      animate() {
        throw new Error("animate() should not be called when reducedMotion snaps")
      },
    }
  }

  it("snaps to final value and skips backend setup when reducedMotion='always'", async () => {
    const t = mockTarget()
    const def = tween({ opacity: [0, 1], translateX: [0, 100] }, { duration: 800 })
    const handle = playStrategy(def, [t], { reducedMotion: "always" })
    expect(handle.state).toBe("finished")
    expect(handle.progress).toBe(1)
    expect(t.styles.get("opacity")).toBe("1")
    expect(t.styles.get("transform")).toBe("translateX(100px)")
    await expect(handle.finished).resolves.toBeUndefined()
  })

  it("does not snap when reducedMotion='never'", () => {
    const t = mockTarget()
    const def = tween({ opacity: [0, 1] }, { duration: 100 })
    const handle = playStrategy(def, [t], { reducedMotion: "never", lazy: false })
    expect(handle.state).not.toBe("finished")
    handle.cancel()
  })

  it("snap handle's cancel transitions state to cancelled", () => {
    const t = mockTarget()
    const def = tween({ opacity: [0, 1] }, { duration: 100 })
    const handle = playStrategy(def, [t], { reducedMotion: "always" })
    expect(handle.state).toBe("finished")
    handle.cancel()
    expect(handle.state).toBe("cancelled")
  })
})
