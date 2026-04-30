import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTime } from "./useTime"

describe("useTime", () => {
  let queue: Array<(t: number) => void> = []

  beforeEach(() => {
    queue = []
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void): number => {
      queue.push(cb)
      return queue.length
    })
    vi.stubGlobal("cancelAnimationFrame", (): void => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns a stable cell across re-renders", () => {
    const seen: unknown[] = []
    function Probe() {
      const t = useTime()
      seen.push(t)
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(seen[0]).toBe(seen[1])
  })

  it("ticks while a listener is attached", () => {
    let lastValue = -1
    function Probe() {
      const t = useTime()
      t.on((v) => {
        lastValue = v
      })
      return null
    }
    render(<Probe />)
    act(() => {
      const cb = queue.shift()
      if (cb) cb(0)
    })
    expect(lastValue).toBeGreaterThanOrEqual(0)
  })

  it("destroys the cell on unmount", () => {
    let captured: ReturnType<typeof useTime> | null = null
    const spy = vi.fn()
    function Probe() {
      const t = useTime()
      captured = t
      t.on(spy)
      return null
    }
    const { unmount } = render(<Probe />)
    act(() => {
      unmount()
    })
    captured!.set(123)
    expect(spy).not.toHaveBeenCalled()
  })
})
