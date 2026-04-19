import { render } from "@testing-library/react"
import { tween } from "@kinem/core"
import type { PointerHandlers, PointerSource } from "@kinem/core"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"
import { useGesture } from "./useGesture"

type G = ReturnType<typeof useGesture<HTMLDivElement>>

function Probe({ onReady }: { onReady: (g: G) => void }) {
  const g = useGesture<HTMLDivElement>({
    hover: { enter: tween({ width: ["0px", "100px"] }, { duration: 20 }), backend: "raf" },
  })
  useEffect(() => {
    onReady(g)
  }, [g, onReady])
  return <div data-testid="g" ref={g.ref} />
}

function makeInertSource(): PointerSource {
  return {
    bind(_el, _handlers: PointerHandlers) {
      return () => {}
    },
  }
}

describe("useGesture", () => {
  it("returns a stable object across renders", () => {
    let seen: G | undefined
    const { rerender } = render(
      <Probe
        onReady={(g) => {
          seen = g
        }}
      />,
    )
    const first = seen
    rerender(
      <Probe
        onReady={(g) => {
          seen = g
        }}
      />,
    )
    expect(seen).toBe(first)
  })

  it("binds a hover handle when the ref is attached", () => {
    let seen: G | undefined
    render(
      <Probe
        onReady={(g) => {
          seen = g
        }}
      />,
    )
    expect(seen).toBeDefined()
    expect(seen?.hover).not.toBeNull()
    expect(seen?.drag).toBeNull()
  })

  it("cancels both handles on unmount", () => {
    let seen: G | undefined
    const { unmount } = render(
      <Probe
        onReady={(g) => {
          seen = g
        }}
      />,
    )
    const hover = seen?.hover
    expect(hover).not.toBeNull()
    unmount()
    expect(hover?.state).toBe("cancelled")
  })

  it("binds a drag handle when drag opts are provided (with custom source)", () => {
    const source = makeInertSource()

    function DragProbe({ onReady }: { onReady: (g: G) => void }) {
      const g = useGesture<HTMLDivElement>({
        drag: { source, applyTouchAction: false },
      })
      useEffect(() => {
        onReady(g)
      }, [g, onReady])
      return <div ref={g.ref} />
    }

    let seen: G | undefined
    render(
      <DragProbe
        onReady={(g) => {
          seen = g
        }}
      />,
    )
    expect(seen?.drag).not.toBeNull()
    expect(seen?.drag?.phase).toBe("idle")
    expect(seen?.hover).toBeNull()
  })

  it("cancel() cancels active handles and clears references", () => {
    let seen: G | undefined
    render(
      <Probe
        onReady={(g) => {
          seen = g
        }}
      />,
    )
    if (!seen) throw new Error("no gesture")
    seen.cancel()
    expect(seen.hover).toBeNull()
    expect(seen.drag).toBeNull()
  })
})
