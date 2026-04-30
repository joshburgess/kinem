// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h } from "vue"
import { useAnimate } from "./useAnimate"

describe("useAnimate (vue)", () => {
  it("animates elements matching the selector inside scope", async () => {
    let animateRef: ReturnType<typeof useAnimate>["animate"] | null = null
    const Comp = defineComponent({
      setup() {
        const { scope, animate } = useAnimate()
        animateRef = animate
        const setRef = (el: unknown): void => {
          scope.value = el as HTMLElement | null
        }
        return () =>
          h("ul", { ref: setRef }, [h("li", { class: "row" }), h("li", { class: "row" })])
      },
    })
    mount(Comp, { attachTo: document.body })
    const controls = animateRef!("li.row", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
  })

  it("returns settled controls when no targets resolve", async () => {
    let animateRef: ReturnType<typeof useAnimate>["animate"] | null = null
    const Comp = defineComponent({
      setup() {
        const { scope, animate } = useAnimate()
        animateRef = animate
        const setRef = (el: unknown): void => {
          scope.value = el as HTMLElement | null
        }
        return () => h("div", { ref: setRef })
      },
    })
    mount(Comp, { attachTo: document.body })
    const controls = animateRef!(".missing", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
  })
})
