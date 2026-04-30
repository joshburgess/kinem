// @vitest-environment happy-dom

import type { MotionValue } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { defineComponent, h } from "vue"
import { useMotionValue } from "./useMotionValue"

describe("useMotionValue (vue)", () => {
  it("returns a MotionValue with the initial value", () => {
    let captured: MotionValue<number> | null = null
    const Comp = defineComponent({
      setup() {
        captured = useMotionValue(42)
        return () => h("div")
      },
    })
    mount(Comp)
    expect(captured!.get()).toBe(42)
  })

  it("does not retrigger renders when set() is called", () => {
    let renders = 0
    let mvRef: MotionValue<number> | null = null
    const Comp = defineComponent({
      setup() {
        const mv = useMotionValue(0)
        mvRef = mv
        return () => {
          renders++
          return h("div")
        }
      },
    })
    mount(Comp)
    const baseline = renders
    mvRef!.set(1)
    mvRef!.set(2)
    mvRef!.set(3)
    expect(renders).toBe(baseline)
  })

  it("destroys the cell on unmount", () => {
    const spy = vi.fn()
    let mvRef: MotionValue<number> | null = null
    const Comp = defineComponent({
      setup() {
        const mv = useMotionValue(0)
        mvRef = mv
        mv.on(spy)
        return () => h("div")
      },
    })
    const wrapper = mount(Comp)
    wrapper.unmount()
    mvRef!.set(99)
    expect(spy).not.toHaveBeenCalled()
  })
})
