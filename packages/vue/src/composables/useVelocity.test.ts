// @vitest-environment happy-dom

import { motionValue } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { defineComponent, h } from "vue"
import { useVelocity } from "./useVelocity"

describe("useVelocity (vue)", () => {
  it("mirrors the source's per-second derivative", () => {
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    const x = motionValue(0)
    let captured: ReturnType<typeof useVelocity> | null = null
    const Comp = defineComponent({
      setup() {
        captured = useVelocity(x)
        return () => h("div")
      },
    })
    mount(Comp)
    now = 0
    x.set(50)
    now = 50
    x.set(150)
    expect(captured!.get()).toBeCloseTo(2000, -1)
    vi.restoreAllMocks()
  })

  it("destroys on unmount", () => {
    const x = motionValue(0)
    let captured: ReturnType<typeof useVelocity> | null = null
    const spy = vi.fn()
    const Comp = defineComponent({
      setup() {
        captured = useVelocity(x)
        captured.on(spy)
        return () => h("div")
      },
    })
    const wrapper = mount(Comp)
    wrapper.unmount()
    captured!.set(99)
    expect(spy).not.toHaveBeenCalled()
  })
})
