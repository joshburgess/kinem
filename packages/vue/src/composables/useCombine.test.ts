// @vitest-environment happy-dom

import { motionValue } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { defineComponent, h } from "vue"
import { useCombine } from "./useCombine"

describe("useCombine (vue)", () => {
  it("derives the initial value and tracks updates", () => {
    const x = motionValue(0)
    const y = motionValue(0)
    let captured: ReturnType<typeof useCombine<readonly [typeof x, typeof y], number>> | null = null
    const Comp = defineComponent({
      setup() {
        captured = useCombine([x, y] as const, (a, b) => a + b)
        return () => h("div")
      },
    })
    mount(Comp)
    expect(captured!.get()).toBe(0)
    x.set(3)
    expect(captured!.get()).toBe(3)
    y.set(4)
    expect(captured!.get()).toBe(7)
  })

  it("destroys on unmount", () => {
    const x = motionValue(0)
    let captured: ReturnType<typeof useCombine<readonly [typeof x], number>> | null = null
    const spy = vi.fn()
    const Comp = defineComponent({
      setup() {
        captured = useCombine([x] as const, (a) => a * 2)
        captured.on(spy)
        return () => h("div")
      },
    })
    const wrapper = mount(Comp)
    wrapper.unmount()
    x.set(99)
    expect(spy).not.toHaveBeenCalled()
  })
})
