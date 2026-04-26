import { tween } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, onMounted } from "vue"
import { type UseGestureResult, useGesture } from "./useGesture"

const enterAnim = () => tween({ opacity: [0, 1] }, { duration: 50 })

function harness(
  opts: Parameters<typeof useGesture>[0],
  onReady: (g: UseGestureResult<HTMLDivElement>) => void,
): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup() {
      const g = useGesture<HTMLDivElement>(opts)
      onMounted(() => onReady(g))
      return () => h("div", { ref: g.ref as unknown as string })
    },
  })
}

describe("useGesture (vue)", () => {
  it("attaches a drag handle when drag opts are provided", () => {
    let use: UseGestureResult<HTMLDivElement> | undefined
    mount(
      harness({ drag: { axis: "x" } }, (g) => {
        use = g
      }),
    )
    expect(use?.drag.value).not.toBeNull()
    expect(use?.hover.value).toBeNull()
  })

  it("attaches a hover handle when hover opts are provided", () => {
    let use: UseGestureResult<HTMLDivElement> | undefined
    mount(
      harness({ hover: { enter: enterAnim() } }, (g) => {
        use = g
      }),
    )
    expect(use?.hover.value).not.toBeNull()
    expect(use?.drag.value).toBeNull()
  })

  it("cancels every gesture on unmount", () => {
    let use: UseGestureResult<HTMLDivElement> | undefined
    const wrapper = mount(
      harness({ drag: {}, hover: { enter: enterAnim() } }, (g) => {
        use = g
      }),
    )
    expect(use?.drag.value).not.toBeNull()
    expect(use?.hover.value).not.toBeNull()
    wrapper.unmount()
    expect(use?.drag.value).toBeNull()
    expect(use?.hover.value).toBeNull()
  })

  it("cancel() cleans up without unmounting", () => {
    let use: UseGestureResult<HTMLDivElement> | undefined
    mount(
      harness({ drag: {}, hover: { enter: enterAnim() } }, (g) => {
        use = g
      }),
    )
    use?.cancel()
    expect(use?.drag.value).toBeNull()
    expect(use?.hover.value).toBeNull()
  })
})
