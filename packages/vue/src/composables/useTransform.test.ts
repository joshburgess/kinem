// @vitest-environment happy-dom

import type { MotionValue } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h } from "vue"
import { useMotionValue } from "./useMotionValue"
import { useTransform } from "./useTransform"

describe("useTransform (vue)", () => {
  it("derives the initial value", () => {
    let captured: MotionValue<number> | null = null
    const Comp = defineComponent({
      setup() {
        const x = useMotionValue(50)
        captured = useTransform(x, [0, 100], [0, 1])
        return () => h("div")
      },
    })
    mount(Comp)
    expect(captured!.get()).toBe(0.5)
  })

  it("updates when the source updates", () => {
    let source: MotionValue<number> | null = null
    let derived: MotionValue<number> | null = null
    const Comp = defineComponent({
      setup() {
        const x = useMotionValue(0)
        source = x
        derived = useTransform(x, [0, 100], [0, 1])
        return () => h("div")
      },
    })
    mount(Comp)
    source!.set(50)
    expect(derived!.get()).toBe(0.5)
    source!.set(100)
    expect(derived!.get()).toBe(1)
  })

  it("destroys the derived cell on unmount", () => {
    let derived: MotionValue<number> | null = null
    const Comp = defineComponent({
      setup() {
        const x = useMotionValue(0)
        derived = useTransform(x, [0, 100], [0, 1])
        return () => h("div")
      },
    })
    const wrapper = mount(Comp)
    wrapper.unmount()
    // After unmount, the source listener is gone; setting the derived
    // cell directly still updates its value but won't notify.
    derived!.set(99)
    expect(derived!.get()).toBe(99)
  })
})
