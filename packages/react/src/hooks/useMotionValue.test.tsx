import { act, render } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"
import { useMotionValue } from "./useMotionValue"

describe("useMotionValue", () => {
  it("returns the same MotionValue across re-renders", () => {
    const seen: unknown[] = []
    function Probe() {
      const mv = useMotionValue(0)
      seen.push(mv)
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    rerender(<Probe />)
    expect(seen[0]).toBe(seen[1])
    expect(seen[1]).toBe(seen[2])
  })

  it("does not re-render the host on set()", () => {
    let renders = 0
    function Probe() {
      renders++
      const mv = useMotionValue(0)
      useEffect(() => {
        mv.set(1)
        mv.set(2)
        mv.set(3)
      }, [mv])
      return null
    }
    render(<Probe />)
    // One initial render plus React's effect cycle (StrictMode would
    // double, but tests run without StrictMode here).
    expect(renders).toBe(1)
  })

  it("destroys the cell on unmount", () => {
    const spy = vi.fn()
    let captured: ReturnType<typeof useMotionValue<number>> | null = null
    function Probe() {
      const mv = useMotionValue(0)
      captured = mv
      mv.on(spy)
      return null
    }
    const { unmount } = render(<Probe />)
    act(() => {
      unmount()
    })
    captured!.set(99)
    expect(spy).not.toHaveBeenCalled()
  })
})
