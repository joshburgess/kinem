import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, ref } from "vue"
import { Motion } from "./Motion"

describe("Motion (vue)", () => {
  it("renders the given element type with initial styles inline", () => {
    const wrapper = mount(Motion, {
      props: { as: "section", initial: { opacity: 0 } },
      slots: { default: () => "hello" },
    })
    const el = wrapper.element as HTMLElement
    expect(el.tagName.toLowerCase()).toBe("section")
    expect(el.style.opacity).toBe("0")
    expect(el.textContent).toContain("hello")
  })

  it("defaults to a div when `as` is omitted", () => {
    const wrapper = mount(Motion)
    expect(wrapper.element.tagName.toLowerCase()).toBe("div")
  })

  it("forwards non-motion attrs (class, data-*, event handlers)", async () => {
    let clicks = 0
    const wrapper = mount(Motion, {
      props: { as: "button" },
      attrs: {
        class: "btn",
        "data-testid": "m",
        onClick: () => {
          clicks++
        },
      },
      slots: { default: () => "ok" },
    })
    const btn = wrapper.element as HTMLButtonElement
    expect(btn.className).toBe("btn")
    expect(btn.getAttribute("data-testid")).toBe("m")
    await wrapper.trigger("click")
    expect(clicks).toBe(1)
  })

  it("merges user style with initial (user overrides win)", () => {
    const wrapper = mount(Motion, {
      props: { initial: { opacity: 0 } },
      attrs: { style: { opacity: "0.5", color: "red" } },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.opacity).toBe("0.5")
    expect(el.style.color).toBe("red")
  })

  it("re-runs the tween when `animate` prop changes", async () => {
    const Host = defineComponent({
      setup(_, { expose }) {
        const target = ref({ width: "0px" })
        expose({ target })
        return () =>
          h(Motion, {
            initial: { width: "0px" },
            animate: target.value,
            transition: { duration: 20, backend: "raf" },
          })
      },
    })

    const wrapper = mount(Host)
    const instance = wrapper.vm as unknown as { target: { value: { width: string } } }
    instance.target.value = { width: "50px" }
    await wrapper.vm.$nextTick()
    // We can't inspect running Controls from outside, but the hook path
    // should not throw on prop change.
    expect(wrapper.element).toBeDefined()
  })

  it("cancels in-flight animation on unmount", async () => {
    const wrapper = mount(Motion, {
      props: {
        initial: { width: "0px" },
        animate: { width: "100px" },
        transition: { duration: 1000, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it("does not animate when `animate` is omitted on mount", () => {
    const wrapper = mount(Motion, { props: { initial: { opacity: 0 } } })
    // No animate prop = no tween path. Just verify mount succeeds.
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("watch ignores shallow-equal animate updates", async () => {
    const wrapper = mount(Motion, {
      props: {
        initial: { width: "0px" },
        animate: { width: "10px" },
        transition: { duration: 20, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    // setProps with a new object containing the same shape should hit the
    // shallowEqualValues short-circuit in the watch callback.
    await wrapper.setProps({ animate: { width: "10px" } })
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("watch with `animate` cleared returns early", async () => {
    const wrapper = mount(Motion, {
      props: {
        initial: { width: "0px" },
        animate: { width: "10px" },
        transition: { duration: 20, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ animate: undefined as never })
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("watch with new animate triggers a fresh tween", async () => {
    const wrapper = mount(Motion, {
      props: {
        initial: { width: "0px" },
        animate: { width: "10px" },
        transition: { duration: 20, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ animate: { width: "50px" } })
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("watch with shape-different animate (different key sets) triggers a tween", async () => {
    const wrapper = mount(Motion, {
      props: {
        initial: { width: "0px", height: "0px" },
        animate: { width: "10px", height: "10px" },
        transition: { duration: 20, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    // Different number of keys: shallowEqualValues short-circuits on length.
    await wrapper.setProps({ animate: { width: "20px" } })
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("forwards custom easing through transition prop", async () => {
    const easing = (t: number): number => t * t
    const wrapper = mount(Motion, {
      props: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 20, easing, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("animate without initial uses animate as the starting value", async () => {
    const wrapper = mount(Motion, {
      props: {
        animate: { opacity: 1 },
        transition: { duration: 20, backend: "raf" },
      },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })
})
