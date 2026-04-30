import { act, render } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { useMotionValue } from "./useMotionValue"
import { useMotionValueEvent } from "./useMotionValueEvent"

describe("useMotionValueEvent", () => {
  it("fires the listener on every change", () => {
    let captured: ReturnType<typeof useMotionValue<number>> | null = null
    const seen: number[] = []
    function Probe() {
      const x = useMotionValue(0)
      captured = x
      useMotionValueEvent(x, "change", (v) => seen.push(v))
      return null
    }
    render(<Probe />)
    captured!.set(1)
    captured!.set(2)
    captured!.set(3)
    expect(seen).toEqual([1, 2, 3])
  })

  it("uses the latest listener identity without re-subscribing", () => {
    let captured: ReturnType<typeof useMotionValue<number>> | null = null
    let total = 0
    function Probe({ multiplier }: { multiplier: number }) {
      const x = useMotionValue(0)
      captured = x
      useMotionValueEvent(x, "change", (v) => {
        total += v * multiplier
      })
      return null
    }
    const { rerender } = render(<Probe multiplier={1} />)
    captured!.set(10)
    expect(total).toBe(10)
    rerender(<Probe multiplier={2} />)
    captured!.set(5)
    expect(total).toBe(20)
  })

  it("unsubscribes on unmount", () => {
    let captured: ReturnType<typeof useMotionValue<number>> | null = null
    let calls = 0
    function Probe() {
      const x = useMotionValue(0)
      captured = x
      useMotionValueEvent(x, "change", () => {
        calls++
      })
      return null
    }
    const { unmount } = render(<Probe />)
    captured!.set(1)
    expect(calls).toBe(1)
    act(() => {
      unmount()
    })
    captured!.set(2)
    expect(calls).toBe(1)
  })
})
