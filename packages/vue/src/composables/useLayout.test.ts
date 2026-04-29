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
})
