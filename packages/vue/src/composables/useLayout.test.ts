import { createLayoutGroup } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, nextTick, onMounted, ref } from "vue"
import { type UseLayoutResult, useLayout } from "./useLayout"

function harness(
  opts: Parameters<typeof useLayout>[0],
  onReady: (l: UseLayoutResult<HTMLDivElement>) => void,
): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup() {
      const l = useLayout<HTMLDivElement>(opts)
      onMounted(() => onReady(l))
      return () => h("div", { ref: l.ref as unknown as string })
    },
  })
}

describe("useLayout (vue)", () => {
  it("exposes a ref that binds to the host element after mount", () => {
    let use: UseLayoutResult<HTMLDivElement> | undefined
    const wrapper = mount(
      harness({ duration: 100 }, (l) => {
        use = l
      }),
    )
    expect(use?.ref.value).toBeInstanceOf(HTMLElement)
    wrapper.unmount()
  })

  it("does not throw on mount, update, or unmount", async () => {
    const counter = ref(0)
    const wrapper = mount(
      defineComponent({
        setup() {
          const l = useLayout<HTMLDivElement>({ duration: 50 })
          return () => h("div", { ref: l.ref as unknown as string }, String(counter.value))
        },
      }),
    )
    counter.value = 1
    await nextTick()
    counter.value = 2
    await nextTick()
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it("accepts an empty opts object", () => {
    let use: UseLayoutResult<HTMLDivElement> | undefined
    const wrapper = mount(
      harness({}, (l) => {
        use = l
      }),
    )
    expect(use?.ref.value).toBeInstanceOf(HTMLElement)
    wrapper.unmount()
  })

  it("accepts animateScale: false without throwing", () => {
    const wrapper = mount(
      harness({ animateScale: false }, () => {
        // no-op
      }),
    )
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it("captures rect on unmount under layoutId", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    const fakeRect = { left: 7, top: 8, width: 9, height: 10 } as DOMRect
    const original = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = () => fakeRect
    const wrapper = mount(
      harness({ layoutId: "shared-vue", layoutGroup: group }, () => {
        // no-op
      }),
    )
    wrapper.unmount()
    Element.prototype.getBoundingClientRect = original
    const snap = group.consume("shared-vue")
    expect(snap?.rect.left).toBe(7)
    expect(snap?.rect.top).toBe(8)
  })

  it("consumes a captured rect on mount under matching layoutId", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    group.capture("shared-vue-2", { left: 0, top: 0, width: 5, height: 5 })
    const wrapper = mount(
      harness({ layoutId: "shared-vue-2", layoutGroup: group }, () => {
        // no-op
      }),
    )
    expect(group.consume("shared-vue-2")).toBeUndefined()
    wrapper.unmount()
  })
})
