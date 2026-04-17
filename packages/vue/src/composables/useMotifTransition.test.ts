import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { Transition, defineComponent, h, ref } from "vue"
import { useMotifTransition } from "./useMotifTransition"

describe("useMotifTransition (vue)", () => {
  it("returns the expected hook surface", () => {
    const t = useMotifTransition({
      enter: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 20, backend: "raf" },
    })
    expect(typeof t.onBeforeEnter).toBe("function")
    expect(typeof t.onEnter).toBe("function")
    expect(typeof t.onLeave).toBe("function")
    expect(typeof t.onEnterCancelled).toBe("function")
    expect(typeof t.onLeaveCancelled).toBe("function")
  })

  it("onBeforeEnter applies `from` as inline styles", () => {
    const t = useMotifTransition({
      enter: { from: { opacity: 0 }, to: { opacity: 1 } },
    })
    const el = document.createElement("div")
    t.onBeforeEnter(el)
    expect(el.style.opacity).toBe("0")
  })

  it("onEnter without an enter phase still calls done()", () => {
    const t = useMotifTransition({})
    let called = false
    t.onEnter(document.createElement("div"), () => {
      called = true
    })
    expect(called).toBe(true)
  })

  it("onLeave without a leave phase still calls done()", () => {
    const t = useMotifTransition({})
    let called = false
    t.onLeave(document.createElement("div"), () => {
      called = true
    })
    expect(called).toBe(true)
  })

  it("onEnter starts a tween and eventually resolves done()", async () => {
    const t = useMotifTransition({
      enter: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 20, backend: "raf" },
    })
    const el = document.createElement("div")
    document.body.appendChild(el)
    const done = await new Promise<boolean>((resolve) => {
      t.onEnter(el, () => resolve(true))
      setTimeout(() => resolve(false), 500)
    })
    document.body.removeChild(el)
    expect(done).toBe(true)
  })

  it("spreads cleanly onto <Transition> without throwing", async () => {
    const Host = defineComponent({
      setup() {
        const show = ref(true)
        const t = useMotifTransition({
          enter: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 20, backend: "raf" },
          leave: { from: { opacity: 1 }, to: { opacity: 0 }, duration: 20, backend: "raf" },
        })
        return () =>
          h(
            Transition,
            { css: false, ...t },
            { default: () => (show.value ? h("div", { key: "a" }, "a") : null) },
          )
      },
    })
    const wrapper = mount(Host)
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })
})
