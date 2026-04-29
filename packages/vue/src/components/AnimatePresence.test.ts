import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, inject, nextTick, ref } from "vue"
import { AnimatePresence } from "./AnimatePresence"
import { PresenceKey } from "./presence"

const PresenceProbe = defineComponent({
  name: "PresenceProbe",
  emits: { exit: () => true },
  setup(_p, { emit, slots }) {
    const presence = inject(PresenceKey, null)
    return () => {
      const node = h(
        "div",
        { "data-present": presence?.isPresent ? "true" : "false" },
        slots["default"]?.(),
      )
      if (presence && !presence.isPresent) emit("exit")
      return node
    }
  },
})

describe("AnimatePresence (vue)", () => {
  it("renders keyed children inside a presence provider with isPresent=true", () => {
    const wrapper = mount(AnimatePresence, {
      slots: {
        default: () => [h(PresenceProbe, { key: "a" }, { default: () => "alpha" })],
      },
    })
    const el = wrapper.element.querySelector("[data-present]") as HTMLElement
    expect(el).not.toBeNull()
    expect(el.getAttribute("data-present")).toBe("true")
    expect(el.textContent).toContain("alpha")
  })

  it("keeps a removed key mounted with isPresent=false until safeToRemove is called", async () => {
    const show = ref(true)
    const captured: { value: { isPresent: boolean; safeToRemove: () => void } | null } = {
      value: null,
    }
    const Capture = defineComponent({
      setup() {
        const p = inject(PresenceKey, null)
        if (p) captured.value = p
        return () => h("div", { "data-cap": p?.isPresent ? "yes" : "no" })
      },
    })
    const wrapper = mount(
      defineComponent({
        components: { AnimatePresence, Capture },
        setup: () => ({ show }),
        template: `<AnimatePresence><Capture v-if="show" key="x" /></AnimatePresence>`,
      }),
    )
    expect(wrapper.element.querySelector("[data-cap]")?.getAttribute("data-cap")).toBe("yes")

    show.value = false
    await nextTick()
    // Should still be in the DOM, but flagged not-present.
    const node = wrapper.element.querySelector("[data-cap]") as HTMLElement | null
    expect(node).not.toBeNull()
    expect(node?.getAttribute("data-cap")).toBe("no")

    // Once the child signals safe-to-remove, it leaves the tree.
    captured.value?.safeToRemove()
    await nextTick()
    expect(wrapper.element.querySelector("[data-cap]")).toBeNull()
  })

  it("treats unkeyed children as static (passes through, no presence wrapping)", () => {
    const wrapper = mount(AnimatePresence, {
      slots: {
        default: () => [h("span", "no key")],
      },
    })
    // Unkeyed VNodes are filtered out of the presence tracker entirely.
    expect(wrapper.element.textContent).toBe("")
  })
})
