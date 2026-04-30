import { createRoot } from "solid-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTime } from "./createTime"

describe("createTime (solid)", () => {
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

  it("returns a TimeMotionValue and ticks while a listener is attached", () => {
    createRoot((dispose) => {
      const t = createTime()
      let lastValue = -1
      t.on((v) => {
        lastValue = v
      })
      const cb = queue.shift()
      if (cb) cb(0)
      expect(lastValue).toBeGreaterThanOrEqual(0)
      dispose()
    })
  })

  it("destroys the cell on dispose", () => {
    let mvRef: ReturnType<typeof createTime> | null = null
    const spy = vi.fn()
    createRoot((dispose) => {
      const t = createTime()
      mvRef = t
      t.on(spy)
      dispose()
    })
    mvRef!.set(123)
    expect(spy).not.toHaveBeenCalled()
  })
})
