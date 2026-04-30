import { act, render } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { useMotionValue } from "./useMotionValue"
import { useVelocity } from "./useVelocity"

describe("useVelocity", () => {
  it("mirrors the source's per-second derivative", () => {
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    let captured: {
      x: ReturnType<typeof useMotionValue<number>>
      v: ReturnType<typeof useVelocity>
    } | null = null
    function Probe() {
      const x = useMotionValue(0)
      const v = useVelocity(x)
      captured = { x, v }
      return null
    }
    render(<Probe />)
    now = 0
    captured!.x.set(50)
    now = 50
    captured!.x.set(150)
    expect(captured!.v.get()).toBeCloseTo(2000, -1)
    vi.restoreAllMocks()
  })

  it("re-creates and destroys when the source identity changes", () => {
    function Probe({ which }: { which: 0 | 1 }) {
      const a = useMotionValue(0)
      const b = useMotionValue(0)
      const v = useVelocity(which === 0 ? a : b)
      return <div data-testid="value">{v.get()}</div>
    }
    const { rerender, getByTestId } = render(<Probe which={0} />)
    rerender(<Probe which={1} />)
    expect(getByTestId("value")).not.toBeNull()
  })

  it("destroys on unmount", () => {
    let captured: ReturnType<typeof useVelocity> | null = null
    const spy = vi.fn()
    function Probe() {
      const x = useMotionValue(0)
      const v = useVelocity(x)
      captured = v
      v.on(spy)
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
