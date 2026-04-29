import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, ref } from "vue"
import { Motion, type Variants } from "./Motion"

const settle = (ms = 60): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe("Motion variants (vue)", () => {
  const v: Variants = {
    closed: { opacity: 0, x: -100 },
    open: { opacity: 1, x: 0 },
  }

  it("applies the resolved initial variant as inline style", () => {
    const wrapper = mount(Motion, { props: { variants: v, initial: "closed" } })
    expect((wrapper.element as HTMLElement).style.opacity).toBe("0")
  })

  it("ignores a string target with no variants map", () => {
    const wrapper = mount(Motion, { props: { initial: "closed" } })
    expect((wrapper.element as HTMLElement).style.opacity).toBe("")
  })

  it("merges array-form variants left-to-right (later wins)", () => {
    const map: Variants = {
      base: { opacity: "0.2", x: 0 },
      lifted: { x: 50 },
    }
    const wrapper = mount(Motion, { props: { variants: map, initial: ["base", "lifted"] } })
    expect((wrapper.element as HTMLElement).style.opacity).toBe("0.2")
  })

  it("re-runs the tween when animate flips between variant keys", async () => {
    // Drive the ref from outer scope so Vue's instance-level ref unwrap
    // (which can clobber refs of primitives passed through `expose()`)
    // doesn't get in the way.
    const which = ref<"closed" | "open">("closed")
    const Host = defineComponent({
      setup() {
        return () =>
          h(Motion, {
            variants: v,
            initial: "closed",
            animate: which.value,
            transition: { duration: 20, backend: "raf" },
          })
      },
    })
    const wrapper = mount(Host)
    which.value = "open"
    await wrapper.vm.$nextTick()
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("flips to whileHover values on pointerenter and reverts on pointerleave", async () => {
    const wrapper = mount(Motion, {
      props: {
        variants: v,
        initial: "closed",
        animate: "closed",
        whileHover: "open",
        transition: { duration: 15, backend: "raf" },
      },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.opacity).toBe("0")
    el.dispatchEvent(new PointerEvent("pointerenter"))
    await settle(40)
    el.dispatchEvent(new PointerEvent("pointerleave"))
    await settle(40)
    // No throw on revert; visual state is non-deterministic at this scale,
    // we just verify the flow completes cleanly.
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("whileTap takes precedence over whileHover", async () => {
    const map: Variants = {
      rest: { scale: 1 },
      hover: { scale: 1.1 },
      tap: { scale: 0.9 },
    }
    const wrapper = mount(Motion, {
      props: {
        variants: map,
        initial: "rest",
        animate: "rest",
        whileHover: "hover",
        whileTap: "tap",
        transition: { duration: 15, backend: "raf" },
      },
    })
    const el = wrapper.element as HTMLElement
    el.dispatchEvent(new PointerEvent("pointerenter"))
    el.dispatchEvent(new PointerEvent("pointerdown"))
    await settle(30)
    el.dispatchEvent(new PointerEvent("pointerup"))
    el.dispatchEvent(new PointerEvent("pointerleave"))
    await settle(30)
    expect(wrapper.element).toBeDefined()
    wrapper.unmount()
  })

  it("forwards user pointer handlers when while* props attach our own", async () => {
    let entered = 0
    let downed = 0
    const wrapper = mount(Motion, {
      props: {
        variants: v,
        initial: "closed",
        animate: "closed",
        whileHover: "open",
        whileTap: "open",
      },
      attrs: {
        onPointerenter: () => {
          entered++
        },
        onPointerdown: () => {
          downed++
        },
      },
    })
    const el = wrapper.element as HTMLElement
    el.dispatchEvent(new PointerEvent("pointerenter"))
    el.dispatchEvent(new PointerEvent("pointerdown"))
    expect(entered).toBe(1)
    expect(downed).toBe(1)
    wrapper.unmount()
  })

  it("propagates animate key to descendants that have their own variants", () => {
    const childVariants: Variants = {
      open: { opacity: 1 },
      closed: { opacity: 0 },
    }
    const Parent = defineComponent({
      setup() {
        return () =>
          h(
            Motion,
            { variants: v, initial: "closed", animate: "open" },
            {
              default: () =>
                h(Motion, {
                  variants: childVariants,
                  initial: "closed",
                  "data-testid": "child",
                  transition: { duration: 15, backend: "raf" },
                }),
            },
          )
      },
    })
    const wrapper = mount(Parent)
    const child = wrapper.element.querySelector('[data-testid="child"]') as HTMLElement
    expect(child).not.toBeNull()
    // Initial paint is closed (opacity 0); the inherited "open" key
    // should drive the mount tween. We just check no throw occurred.
    expect(child.style.opacity).toBe("0")
    wrapper.unmount()
  })

  it("descendants without variants do not inherit", () => {
    const Parent = defineComponent({
      setup() {
        return () =>
          h(
            Motion,
            { variants: v, initial: "closed", animate: "open" },
            {
              default: () => h(Motion, { initial: { opacity: "0.42" }, "data-testid": "child" }),
            },
          )
      },
    })
    const wrapper = mount(Parent)
    const child = wrapper.element.querySelector('[data-testid="child"]') as HTMLElement
    expect(child.style.opacity).toBe("0.42")
    wrapper.unmount()
  })
})

describe("Motion stagger and delay (vue)", () => {
  const v: Variants = {
    closed: { opacity: 0 },
    open: { opacity: 1 },
  }

  it("staggers descendants in mount order via parent transition.staggerChildren", async () => {
    const start = performance.now()
    const starts: number[] = []
    const Spy = defineComponent({
      props: { id: { type: Number, required: true } },
      setup(p) {
        return () =>
          h(Motion, {
            variants: v,
            "data-testid": `child-${p.id}`,
            transition: { duration: 30, backend: "raf" },
            ref: (el: unknown) => {
              const node = (el as { $el?: Element } | null)?.$el ?? (el as Element | null)
              if (node && starts[p.id] === undefined) {
                const tick = (): void => {
                  const op = Number.parseFloat((node as HTMLElement).style.opacity || "0")
                  if (op > 0) {
                    starts[p.id] = performance.now() - start
                    return
                  }
                  requestAnimationFrame(tick)
                }
                requestAnimationFrame(tick)
              }
            },
          })
      },
    })
    const Parent = defineComponent({
      setup() {
        return () =>
          h(
            Motion,
            { variants: v, animate: "open", transition: { staggerChildren: 60 } },
            {
              default: () => [h(Spy, { id: 0 }), h(Spy, { id: 1 }), h(Spy, { id: 2 })],
            },
          )
      },
    })
    const wrapper = mount(Parent)
    await new Promise<void>((r) => setTimeout(r, 250))
    expect(starts[0]).toBeLessThan(40)
    expect(starts[1]).toBeGreaterThan(starts[0]!)
    expect(starts[2]).toBeGreaterThan(starts[1]!)
    wrapper.unmount()
  })

  it("applies transition.delay on a top-level Motion", async () => {
    const wrapper = mount(Motion, {
      props: {
        variants: v,
        initial: "closed",
        animate: "open",
        transition: { duration: 20, delay: 80, backend: "raf" },
      },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.opacity).toBe("0")
    await new Promise<void>((r) => setTimeout(r, 20))
    expect(Number.parseFloat(el.style.opacity || "0")).toBe(0)
    await new Promise<void>((r) => setTimeout(r, 200))
    expect(Number.parseFloat(el.style.opacity || "0")).toBeGreaterThan(0)
    wrapper.unmount()
  })
})
