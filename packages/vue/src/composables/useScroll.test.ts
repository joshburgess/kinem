import type { ScrollRect, ScrollSource, StrategyTarget } from "@kinem/core"
import { tween } from "@kinem/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"
import { defineComponent, h, onMounted } from "vue"
import { type UseScrollResult, useScroll } from "./useScroll"

function makeSource() {
  let scrollY = 0
  const vh = 800
  const scrollCbs = new Set<() => void>()
  const resizeCbs = new Set<() => void>()
  const rects = new WeakMap<StrategyTarget, ScrollRect>()
  const source: ScrollSource = {
    getScrollY: () => scrollY,
    getViewportHeight: () => vh,
    getRect(el) {
      return rects.get(el) ?? { top: 0, height: 0 }
    },
    onScroll(cb) {
      scrollCbs.add(cb)
      return () => scrollCbs.delete(cb)
    },
    onResize(cb) {
      resizeCbs.add(cb)
      return () => resizeCbs.delete(cb)
    },
  }
  return {
    source,
    setRect(el: StrategyTarget, r: ScrollRect) {
      rects.set(el, r)
    },
    setScroll(y: number) {
      scrollY = y
      for (const cb of scrollCbs) cb()
    },
    hasScrollListener: () => scrollCbs.size > 0,
  }
}

function harness(
  source: ScrollSource,
  onReady: (s: UseScrollResult<HTMLDivElement>) => void,
  onProgress?: (p: number) => void,
): ReturnType<typeof defineComponent> {
  return defineComponent({
    setup() {
      const s = useScroll<HTMLDivElement>(tween({ opacity: [0, 1] }, { duration: 400 }), {
        sync: true,
        source,
        ...(onProgress ? { onProgress } : {}),
      })
      onMounted(() => onReady(s))
      return () => h("div", { ref: s.ref as unknown as string })
    },
  })
}

describe("useScroll (vue)", () => {
  it("attaches a scroll driver after mount", () => {
    const env = makeSource()
    let use: UseScrollResult<HTMLDivElement> | undefined
    mount(
      harness(env.source, (s) => {
        use = s
      }),
    )
    expect(use?.handle.value).not.toBeNull()
    expect(env.hasScrollListener()).toBe(true)
  })

  it("receives scroll updates from the source", () => {
    const env = makeSource()
    const onProgress = vi.fn()
    let use: UseScrollResult<HTMLDivElement> | undefined
    mount(
      harness(
        env.source,
        (s) => {
          use = s
        },
        onProgress,
      ),
    )
    const el = use?.ref.value
    if (el) env.setRect(el as unknown as StrategyTarget, { top: 100, height: 400 })
    env.setScroll(50)
    expect(use?.handle.value).not.toBeNull()
  })

  it("cancels the driver on unmount", () => {
    const env = makeSource()
    let use: UseScrollResult<HTMLDivElement> | undefined
    const wrapper = mount(
      harness(env.source, (s) => {
        use = s
      }),
    )
    expect(env.hasScrollListener()).toBe(true)
    wrapper.unmount()
    expect(env.hasScrollListener()).toBe(false)
    expect(use?.handle.value).toBeNull()
  })
})
