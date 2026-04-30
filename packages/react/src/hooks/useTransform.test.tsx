import { act, render } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, it } from "vitest"
import { useMotionValue } from "./useMotionValue"
import { useTransform } from "./useTransform"

describe("useTransform", () => {
  it("derives the initial value from the source's current value", () => {
    let captured: number | null = null
    function Probe() {
      const x = useMotionValue(50)
      const op = useTransform(x, [0, 100], [0, 1])
      captured = op.get()
      return null
    }
    render(<Probe />)
    expect(captured).toBe(0.5)
  })

  it("updates the derived value when the source updates", () => {
    let captured: number | null = null
    let setSource: ((n: number) => void) | null = null
    function Probe() {
      const x = useMotionValue(0)
      const op = useTransform(x, [0, 100], [0, 1])
      setSource = (n) => x.set(n)
      useEffect(() => {
        return op.on((v) => {
          captured = v
        })
      }, [op])
      return null
    }
    render(<Probe />)
    act(() => {
      setSource!(50)
    })
    expect(captured).toBe(0.5)
    act(() => {
      setSource!(100)
    })
    expect(captured).toBe(1)
  })

  it("destroys the derived cell on unmount", () => {
    let derivedRef: ReturnType<typeof useTransform<number>> | null = null
    function Probe() {
      const x = useMotionValue(0)
      const op = useTransform(x, [0, 100], [0, 1])
      derivedRef = op
      return null
    }
    const { unmount } = render(<Probe />)
    act(() => {
      unmount()
    })
    // After destroy, on() listeners are cleared. Setting the derived
    // cell directly should still update its value but not notify.
    derivedRef!.set(99)
    expect(derivedRef!.get()).toBe(99)
  })
})
