import { act, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCombine } from "./useCombine"
import { useMotionValue } from "./useMotionValue"

describe("useCombine", () => {
  it("derives the initial value from current source values", () => {
    let captured: ReturnType<
      typeof useCombine<
        readonly [
          ReturnType<typeof useMotionValue<number>>,
          ReturnType<typeof useMotionValue<number>>,
        ],
        number
      >
    > | null = null
    function Probe() {
      const x = useMotionValue(3)
      const y = useMotionValue(4)
      const d = useCombine([x, y] as const, (a, b) => Math.hypot(a, b))
      captured = d
      return null
    }
    render(<Probe />)
    expect(captured!.get()).toBeCloseTo(5)
  })

  it("updates when any source changes", () => {
    let captured: {
      x: ReturnType<typeof useMotionValue<number>>
      y: ReturnType<typeof useMotionValue<number>>
      sum: ReturnType<
        typeof useCombine<
          readonly [
            ReturnType<typeof useMotionValue<number>>,
            ReturnType<typeof useMotionValue<number>>,
          ],
          number
        >
      >
    } | null = null
    function Probe() {
      const x = useMotionValue(0)
      const y = useMotionValue(0)
      const sum = useCombine([x, y] as const, (a, b) => a + b)
      captured = { x, y, sum }
      return null
    }
    render(<Probe />)
    captured!.x.set(2)
    expect(captured!.sum.get()).toBe(2)
    captured!.y.set(5)
    expect(captured!.sum.get()).toBe(7)
  })

  it("destroys on unmount and stops propagating updates", () => {
    let captured: {
      x: ReturnType<typeof useMotionValue<number>>
      sum: ReturnType<
        typeof useCombine<readonly [ReturnType<typeof useMotionValue<number>>], number>
      >
    } | null = null
    const spy = vi.fn()
    function Probe() {
      const x = useMotionValue(0)
      const sum = useCombine([x] as const, (a) => a * 2)
      captured = { x, sum }
      sum.on(spy)
      return null
    }
    const { unmount } = render(<Probe />)
    act(() => {
      unmount()
    })
    captured!.x.set(10)
    expect(spy).not.toHaveBeenCalled()
  })
})
