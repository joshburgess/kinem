import type { ScrollRect, ScrollSource, StrategyTarget } from "@kinem/core"
import { tween } from "@kinem/core"
import { act, render } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
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

type Use = ReturnType<typeof useScroll<HTMLDivElement>>

function Box({
  source,
  onReady,
  onProgress,
}: {
  source: ScrollSource
  onReady?: (r: Use) => void
  onProgress?: (p: number) => void
}) {
  const s = useScroll<HTMLDivElement>(tween({ opacity: [0, 1] }, { duration: 400 }), {
    sync: true,
    source,
    ...(onProgress ? { onProgress } : {}),
  })
  useEffect(() => {
    onReady?.(s)
  }, [s, onReady])
  return <div data-testid="box" ref={s.ref} />
}

describe("useScroll", () => {
  it("attaches a scroll driver when the ref mounts", () => {
    const env = makeSource()
    let use: Use | undefined
    render(
      <Box
        source={env.source}
        onReady={(s) => {
          use = s
        }}
      />,
    )
    expect(use?.handle).not.toBeNull()
    expect(env.hasScrollListener()).toBe(true)
  })

  it("drives progress via the scroll source", () => {
    const env = makeSource()
    const onProgress = vi.fn()
    let use: Use | undefined
    const { getByTestId } = render(
      <Box
        source={env.source}
        onProgress={onProgress}
        onReady={(s) => {
          use = s
        }}
      />,
    )
    const box = getByTestId("box") as unknown as StrategyTarget
    env.setRect(box, { top: 100, height: 400 })
    act(() => {
      env.setScroll(50)
    })
    expect(use?.handle).not.toBeNull()
  })

  it("cancels the driver on unmount", () => {
    const env = makeSource()
    let use: Use | undefined
    const { unmount } = render(
      <Box
        source={env.source}
        onReady={(s) => {
          use = s
        }}
      />,
    )
    expect(use?.handle).not.toBeNull()
    unmount()
    expect(env.hasScrollListener()).toBe(false)
  })
})
