import { createLayoutGroup } from "@kinem/core"
import { render } from "@testing-library/react"
import { useEffect, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { useLayout } from "./useLayout"

type L = ReturnType<typeof useLayout<HTMLDivElement>>

function Probe({ onReady }: { onReady: (l: L) => void }) {
  const l = useLayout<HTMLDivElement>({ duration: 20, backend: "raf" })
  useEffect(() => {
    onReady(l)
  }, [l, onReady])
  return <div ref={l.ref} data-testid="box" />
}

describe("useLayout", () => {
  it("returns a stable object across renders", () => {
    let seen: L | undefined
    const { rerender } = render(
      <Probe
        onReady={(l) => {
          seen = l
        }}
      />,
    )
    const first = seen
    rerender(
      <Probe
        onReady={(l) => {
          seen = l
        }}
      />,
    )
    expect(seen).toBe(first)
  })

  it("no-ops when the element has zero size (happy-dom default)", () => {
    // Happy-dom returns a DOMRect of zeros for getBoundingClientRect.
    // The hook should bail out without attempting to animate.
    const { unmount } = render(
      <Probe
        onReady={() => {
          /* no-op */
        }}
      />,
    )
    expect(() => unmount()).not.toThrow()
  })

  it("measures and attempts to animate when the rect changes", () => {
    // Stub getBoundingClientRect to return distinct rects across renders
    // so the FLIP path fires.
    const rects: DOMRect[] = [
      {
        left: 10,
        top: 10,
        width: 100,
        height: 100,
        right: 110,
        bottom: 110,
        x: 10,
        y: 10,
      } as DOMRect,
      {
        left: 50,
        top: 80,
        width: 100,
        height: 100,
        right: 150,
        bottom: 180,
        x: 50,
        y: 80,
      } as DOMRect,
    ]
    let call = 0
    const original = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => {
      const r = rects[Math.min(call, rects.length - 1)] ?? rects[0]
      call++
      return r as DOMRect
    })

    function Shifter() {
      const [, setN] = useState(0)
      const l = useLayout<HTMLDivElement>({ duration: 20, backend: "raf" })
      useEffect(() => {
        setN(1)
      }, [])
      return <div ref={l.ref} data-testid="shifter" />
    }

    const { unmount } = render(<Shifter />)
    // Two layout passes should occur: initial mount and post-setState.
    expect(call).toBeGreaterThanOrEqual(2)
    unmount()
    Element.prototype.getBoundingClientRect = original
  })

  it("captures rect on unmount under layoutId so a sibling can consume it", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    const rect = {
      left: 50,
      top: 60,
      width: 100,
      height: 80,
      right: 150,
      bottom: 140,
      x: 50,
      y: 60,
    } as DOMRect
    const original = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => rect)

    function A() {
      const l = useLayout<HTMLDivElement>({
        duration: 20,
        backend: "raf",
        layoutId: "shared-x",
        layoutGroup: group,
      })
      return <div ref={l.ref} />
    }

    const { unmount } = render(<A />)
    unmount()
    Element.prototype.getBoundingClientRect = original

    const snap = group.consume("shared-x")
    expect(snap?.rect.left).toBe(50)
    expect(snap?.rect.top).toBe(60)
    expect(snap?.rect.width).toBe(100)
    expect(snap?.rect.height).toBe(80)
  })

  it("consumes a captured rect on mount under matching layoutId", () => {
    const group = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    group.capture("shared-y", { left: 0, top: 0, width: 10, height: 10 })

    function B() {
      const l = useLayout<HTMLDivElement>({
        duration: 20,
        backend: "raf",
        layoutId: "shared-y",
        layoutGroup: group,
      })
      return <div ref={l.ref} />
    }

    render(<B />)
    // The capture should be consumed exactly once on mount.
    expect(group.consume("shared-y")).toBeUndefined()
  })
})
