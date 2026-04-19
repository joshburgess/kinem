import { mount } from "@vue/test-utils"
import { tween } from "@kinem/core"
import { describe, expect, it } from "vitest"
import { defineComponent, h, onMounted } from "vue"
import { type UseAnimationResult, useAnimation } from "./useAnimation"

function harness(
  onReady: (anim: UseAnimationResult<HTMLDivElement>) => void,
): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup() {
      const anim = useAnimation<HTMLDivElement>()
      onMounted(() => onReady(anim))
      return () => h("div", { ref: anim.ref as unknown as string })
    },
  })
}

describe("useAnimation (vue)", () => {
  it("attaches the ref to the rendered element", () => {
    let anim: UseAnimationResult<HTMLDivElement> | undefined
    mount(
      harness((a) => {
        anim = a
      }),
    )
    expect(anim).toBeDefined()
    expect(anim?.ref.value).not.toBeNull()
    expect(anim?.ref.value?.tagName.toLowerCase()).toBe("div")
  })

  it("plays an animation and reports state", () => {
    let anim: UseAnimationResult<HTMLDivElement> | undefined
    mount(
      harness((a) => {
        anim = a
      }),
    )
    if (!anim) throw new Error("no anim")
    expect(anim.state).toBe("idle")
    const controls = anim.play(tween({ width: ["0px", "100px"] }, { duration: 50 }), {
      backend: "raf",
    })
    expect(controls.state === "playing" || controls.state === "finished").toBe(true)
    anim.cancel()
    expect(anim.state).toBe("cancelled")
  })

  it("cancels the in-flight animation when a new one is played", () => {
    let anim: UseAnimationResult<HTMLDivElement> | undefined
    mount(
      harness((a) => {
        anim = a
      }),
    )
    if (!anim) throw new Error("no anim")
    const c1 = anim.play(tween({ width: ["0px", "100px"] }, { duration: 1000 }), {
      backend: "raf",
    })
    anim.play(tween({ width: ["0px", "50px"] }, { duration: 1000 }), { backend: "raf" })
    expect(c1.state).toBe("cancelled")
  })

  it("cancels on unmount", () => {
    let anim: UseAnimationResult<HTMLDivElement> | undefined
    const wrapper = mount(
      harness((a) => {
        anim = a
      }),
    )
    if (!anim) throw new Error("no anim")
    const controls = anim.play(tween({ width: ["0px", "100px"] }, { duration: 1000 }), {
      backend: "raf",
    })
    wrapper.unmount()
    expect(controls.state).toBe("cancelled")
  })
})
