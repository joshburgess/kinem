import { act, render } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSpring } from "./useSpring"

type Spring = ReturnType<typeof useSpring>

function Probe({ initial = 0, onReady }: { initial?: number; onReady: (s: Spring) => void }) {
  const s = useSpring(initial)
  useEffect(() => {
    onReady(s)
  }, [s, onReady])
  return null
}

afterEach(() => {
  vi.useRealTimers()
})

describe("useSpring", () => {
  it("returns a stable value object across renders with the given initial value", () => {
    let seen: Spring | undefined
    let calls = 0
    const { rerender } = render(
      <Probe
        initial={42}
        onReady={(s) => {
          seen = s
          calls++
        }}
      />,
    )
    const first = seen
    expect(first?.get()).toBe(42)
    rerender(
      <Probe
        initial={42}
        onReady={(s) => {
          seen = s
        }}
      />,
    )
    expect(seen).toBe(first)
    expect(calls).toBeGreaterThan(0)
  })

  it("jump() sets the value synchronously and notifies subscribers", () => {
    let spring: Spring | undefined
    render(
      <Probe
        onReady={(s) => {
          spring = s
        }}
      />,
    )
    if (!spring) throw new Error("no spring")

    const seen: number[] = []
    spring.subscribe((v) => seen.push(v))
    act(() => spring?.jump(10))
    expect(spring.get()).toBe(10)
    expect(seen).toEqual([10])
  })

  it("subscribe returns an unsubscribe function", () => {
    let spring: Spring | undefined
    render(
      <Probe
        onReady={(s) => {
          spring = s
        }}
      />,
    )
    if (!spring) throw new Error("no spring")

    const seen: number[] = []
    const off = spring.subscribe((v) => seen.push(v))
    act(() => spring?.jump(1))
    off()
    act(() => spring?.jump(2))
    expect(seen).toEqual([1])
  })

  it("set() on a no-op (target equals current) does not animate", () => {
    let spring: Spring | undefined
    render(
      <Probe
        initial={5}
        onReady={(s) => {
          spring = s
        }}
      />,
    )
    if (!spring) throw new Error("no spring")
    act(() => spring?.set(5))
    expect(spring.isAnimating).toBe(false)
    expect(spring.get()).toBe(5)
  })

  it("set() starts a spring; stop() cancels it", () => {
    let spring: Spring | undefined
    render(
      <Probe
        onReady={(s) => {
          spring = s
        }}
      />,
    )
    if (!spring) throw new Error("no spring")
    act(() => spring?.set(100))
    expect(spring.isAnimating).toBe(true)
    act(() => spring?.stop())
    expect(spring.isAnimating).toBe(false)
  })

  it("cancels any in-flight spring on unmount", () => {
    let spring: Spring | undefined
    const { unmount } = render(
      <Probe
        onReady={(s) => {
          spring = s
        }}
      />,
    )
    if (!spring) throw new Error("no spring")
    act(() => spring?.set(100))
    expect(spring.isAnimating).toBe(true)
    unmount()
    expect(spring.isAnimating).toBe(false)
  })
})
