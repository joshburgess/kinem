// @vitest-environment happy-dom

import { motionValue } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h } from "vue"
import { useMotionValueEvent } from "./useMotionValueEvent"

describe("useMotionValueEvent (vue)", () => {
  it("fires the listener on every change", () => {
    const x = motionValue(0)
    const seen: number[] = []
    const Comp = defineComponent({
      setup() {
        useMotionValueEvent(x, "change", (v) => seen.push(v))
        return () => h("div")
      },
    })
    mount(Comp)
    x.set(1)
    x.set(2)
    x.set(3)
    expect(seen).toEqual([1, 2, 3])
  })

  it("unsubscribes on unmount", () => {
    const x = motionValue(0)
    let calls = 0
    const Comp = defineComponent({
      setup() {
        useMotionValueEvent(x, "change", () => {
          calls++
        })
        return () => h("div")
      },
    })
    const wrapper = mount(Comp)
    x.set(1)
    expect(calls).toBe(1)
    wrapper.unmount()
    x.set(2)
    expect(calls).toBe(1)
  })
})
