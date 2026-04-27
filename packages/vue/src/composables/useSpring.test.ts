import { frame } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { defineComponent, h, onMounted } from "vue"
import { type SpringValue, useSpring } from "./useSpring"

function harness(
  onReady: (s: SpringValue) => void,
  initial = 0,
): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup() {
      const s = useSpring(initial)
      onMounted(() => onReady(s))
      return () => h("div")
    },
  })
}

describe("useSpring (vue)", () => {
  it("exposes the initial value via get()", () => {
    let s: SpringValue | undefined
    mount(
      harness((x) => {
        s = x
      }, 42),
    )
    expect(s?.get()).toBe(42)
  })

  it("jump() sets synchronously and notifies subscribers", () => {
    let s: SpringValue | undefined
    mount(
      harness((x) => {
        s = x
      }),
    )
    if (!s) throw new Error("no spring")
    const seen: number[] = []
    s.subscribe((v) => seen.push(v))
    s.jump(10)
    expect(s.get()).toBe(10)
    expect(seen).toEqual([10])
  })

  it("set() with target === current is a no-op", () => {
    let s: SpringValue | undefined
    mount(
      harness((x) => {
        s = x
      }, 5),
    )
    if (!s) throw new Error("no spring")
    s.set(5)
    expect(s.isAnimating).toBe(false)
  })

  it("set() starts a spring; stop() cancels it", () => {
    let s: SpringValue | undefined
    mount(
      harness((x) => {
        s = x
      }),
    )
    if (!s) throw new Error("no spring")
    s.set(100)
    expect(s.isAnimating).toBe(true)
    s.stop()
    expect(s.isAnimating).toBe(false)
  })

  it("subscribe returns an unsubscribe function", () => {
    let s: SpringValue | undefined
    mount(
      harness((x) => {
        s = x
      }),
    )
    if (!s) throw new Error("no spring")
    const seen: number[] = []
    const off = s.subscribe((v) => seen.push(v))
    s.jump(1)
    off()
    s.jump(2)
    expect(seen).toEqual([1])
  })

  it("cancels any in-flight spring on unmount", () => {
    let s: SpringValue | undefined
    const wrapper = mount(
      harness((x) => {
        s = x
      }),
    )
    if (!s) throw new Error("no spring")
    s.set(100)
    expect(s.isAnimating).toBe(true)
    wrapper.unmount()
    expect(s.isAnimating).toBe(false)
  })

  it("ticks the spring through to completion", () => {
    let s: SpringValue | undefined
    mount(
      harness((x) => {
        s = x
      }),
    )
    if (!s) throw new Error("no spring")
    const seen: number[] = []
    s.subscribe((v) => seen.push(v))
    s.set(100)
    let t = 0
    for (let i = 0; i < 200 && s.isAnimating; i++) {
      t += 16
      frame.flushSync(t)
    }
    expect(seen.length).toBeGreaterThan(0)
    expect(s.get()).toBe(100)
    expect(s.isAnimating).toBe(false)
  })
})
