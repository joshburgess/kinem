// @vitest-environment happy-dom

import type { TimeMotionValue } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defineComponent, h } from "vue"
import { useTime } from "./useTime"

describe("useTime (vue)", () => {
  let queue: Array<(t: number) => void> = []

  beforeEach(() => {
    queue = []
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void): number => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal("cancelAnimationFrame", (): void => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns a TimeMotionValue", () => {
    let captured: TimeMotionValue | null = null
    const Comp = defineComponent({
      setup() {
        captured = useTime()
        return () => h("div")
      },
    })
    mount(Comp)
    expect(typeof captured!.get).toBe("function")
    expect(typeof captured!.on).toBe("function")
  })

  it("ticks while a listener is attached", () => {
    let captured: TimeMotionValue | null = null
    let lastValue = -1
    const Comp = defineComponent({
      setup() {
        captured = useTime()
        captured.on((v) => {
          lastValue = v
        })
        return () => h("div")
      },
    })
    mount(Comp)
    const cb = queue.shift()
    if (cb) cb(0)
    expect(lastValue).toBeGreaterThanOrEqual(0)
  })

  it("destroys the cell on unmount", () => {
    let captured: TimeMotionValue | null = null
    const spy = vi.fn()
    const Comp = defineComponent({
      setup() {
        captured = useTime()
        captured.on(spy)
        return () => h("div")
      },
    })
    const wrapper = mount(Comp)
    wrapper.unmount()
    captured!.set(42)
    expect(spy).not.toHaveBeenCalled()
  })
})
