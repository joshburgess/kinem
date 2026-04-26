// SSR / non-DOM safety check. Runs under the default `environment: node`
// from vitest.config.ts: window, document, Element, requestAnimationFrame
// are all undefined. Importing `@kinem/core` and exercising the
// non-DOM public surface (animation construction, composition, sampling,
// reduced-motion helpers) must not throw.
//
// DOM-touching APIs (`play()` against a selector string, `gesture()`,
// `scroll()`) are expected to throw at call time when DOM is missing.
// We assert that, too — the failure mode should be a thrown Error, not
// a silent module-load crash.

import { describe, expect, it } from "vitest"
import { play } from "./api/play"
import { tween } from "./api/tween"
import { delay, parallel, sequence } from "./core/animation"
import { easeInOut } from "./core/easing"
import {
  getReducedMotionDefault,
  prefersReducedMotion,
  shouldReduceMotion,
} from "./core/reduced-motion"

describe("SSR safety", () => {
  it("module-scope DOM globals are not present (sanity)", () => {
    expect(typeof window).toBe("undefined")
    expect(typeof document).toBe("undefined")
    expect(typeof requestAnimationFrame).toBe("undefined")
  })

  it("tween / sequence / parallel construct without DOM", () => {
    const t = tween({ opacity: [0, 1], x: [0, 100] }, { duration: 200, easing: easeInOut })
    const seq = sequence(t, delay(t, 100))
    const par = parallel(t, t)
    expect(typeof t.duration).toBe("number")
    expect(typeof seq.duration).toBe("number")
    expect(typeof par.duration).toBe("number")
    expect(t.interpolate(0.5)).toEqual({ opacity: expect.any(Number), x: expect.any(Number) })
  })

  it("prefersReducedMotion returns false outside a browser", () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  it("shouldReduceMotion handles all modes without DOM", () => {
    expect(shouldReduceMotion("always")).toBe(true)
    expect(shouldReduceMotion("never")).toBe(false)
    // 'user' delegates to prefersReducedMotion(), which is false in node.
    expect(shouldReduceMotion("user")).toBe(false)
  })

  it("getReducedMotionDefault is the unset default", () => {
    expect(getReducedMotionDefault()).toBe("never")
  })

  it("play() with a selector string throws a typed error in non-DOM env", () => {
    const def = tween({ opacity: [0, 1] }, { duration: 100 })
    expect(() => play(def, ".missing")).toThrowError(/cannot resolve selector/i)
  })

  it("play() with reducedMotion='always' commits values to a structural target without touching DOM", async () => {
    const styles: Record<string, string> = {}
    const target = {
      style: {
        setProperty(name: string, value: string) {
          styles[name] = value
        },
      },
      setAttribute() {},
      animate() {
        throw new Error("animate() must not be called when snap is requested")
      },
    }
    const def = tween({ opacity: [0, 1] }, { duration: 200 })
    const ctrl = play(def, target, { reducedMotion: "always" })
    expect(styles["opacity"]).toBe("1")
    expect(ctrl.state).toBe("finished")
    await ctrl.finished
  })
})
