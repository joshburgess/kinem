// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, ref } from "vue"
import { ReorderGroup, ReorderItem } from "./Reorder"

interface RectMock {
  top: number
  left: number
  width: number
  height: number
}

const mockRect = (el: HTMLElement, r: RectMock): void => {
  el.getBoundingClientRect = (): DOMRect =>
    ({
      top: r.top,
      bottom: r.top + r.height,
      left: r.left,
      right: r.left + r.width,
      width: r.width,
      height: r.height,
      x: r.left,
      y: r.top,
      toJSON: (): RectMock => r,
    }) as DOMRect
}

describe("ReorderGroup / ReorderItem (vue)", () => {
  it("renders the configured `as` element with children", () => {
    const noop = (): void => {}
    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            ReorderGroup as unknown as ReturnType<typeof defineComponent>,
            { values: ["a", "b"], onReorder: noop, axis: "y", as: "ul" },
            () => [
              h(
                ReorderItem as unknown as ReturnType<typeof defineComponent>,
                { value: "a", as: "li" },
                () => "A",
              ),
              h(
                ReorderItem as unknown as ReturnType<typeof defineComponent>,
                { value: "b", as: "li" },
                () => "B",
              ),
            ],
          )
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.findAll("li").length).toBe(2)
    expect(wrapper.find("ul").exists()).toBe(true)
  })

  it("throws when ReorderItem is rendered outside a group", () => {
    const Comp = defineComponent({
      setup() {
        return () =>
          h(ReorderItem as unknown as ReturnType<typeof defineComponent>, { value: "x" }, () => "X")
      },
    })
    expect(() => mount(Comp)).toThrow(/ReorderItem must be rendered inside a ReorderGroup/)
  })

  it("commits a new order when the dragged item passes a sibling's center", () => {
    const items = ref<string[]>(["a", "b", "c"])
    let received: string[] | null = null
    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            ReorderGroup as unknown as ReturnType<typeof defineComponent>,
            {
              values: items.value,
              onReorder: (next: unknown[]) => {
                received = next as string[]
                items.value = next as string[]
              },
              axis: "y",
              as: "ul",
            },
            () =>
              items.value.map((v) =>
                h(
                  ReorderItem as unknown as ReturnType<typeof defineComponent>,
                  { value: v, as: "li", key: v, "data-testid": `item-${v}` },
                  () => v,
                ),
              ),
          )
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    const lis = wrapper.findAll("li").map((w) => w.element as HTMLElement)
    expect(lis).toHaveLength(3)
    mockRect(lis[0]!, { top: 0, left: 0, width: 200, height: 50 })
    mockRect(lis[1]!, { top: 50, left: 0, width: 200, height: 50 })
    mockRect(lis[2]!, { top: 100, left: 0, width: 200, height: 50 })

    lis[0]!.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        clientY: 25,
        clientX: 0,
        bubbles: true,
        button: 0,
      }),
    )
    lis[0]!.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientY: 100,
        clientX: 0,
        bubbles: true,
      }),
    )
    lis[0]!.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 1,
        clientY: 100,
        clientX: 0,
        bubbles: true,
      }),
    )
    expect(received).not.toBeNull()
    expect(received![0]).toBe("b")
    wrapper.unmount()
  })

  it("applies a touch-action that allows the cross-axis pan", () => {
    const noop = (): void => {}
    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            ReorderGroup as unknown as ReturnType<typeof defineComponent>,
            { values: ["a"], onReorder: noop, axis: "y" },
            () =>
              h(
                ReorderItem as unknown as ReturnType<typeof defineComponent>,
                { value: "a" },
                () => "A",
              ),
          )
      },
    })
    const wrapper = mount(Comp)
    const li = wrapper.find("li").element as HTMLElement
    expect(li.style.touchAction).toBe("pan-x")
  })
})
