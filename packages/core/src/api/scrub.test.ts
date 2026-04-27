import { describe, expect, it, vi } from "vitest"
import { scrub } from "./scrub"
import { tween } from "./tween"

interface FakeTarget {
  style: {
    setProperty(name: string, value: string): void
  }
  setAttribute(name: string, value: string): void
  written: Record<string, string>
}

const mkTarget = (): FakeTarget => {
  const t: FakeTarget = {
    written: {},
    style: {
      setProperty(name, value) {
        t.written[name] = value
      },
    },
    setAttribute(name, value) {
      t.written[name] = value
    },
  }
  return t
}

describe("scrub", () => {
  it("push-mode applies progress on setProgress without rAF", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const h = scrub(def, [target as never])
    h.setProgress(0.5)
    expect(target.written["opacity"]).toBe("0.5")
    expect(h.progress).toBe(0.5)
    h.cancel()
  })

  it("clamps progress to [0,1]", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const h = scrub(def, [target as never])
    h.setProgress(-0.5)
    expect(h.progress).toBe(0)
    h.setProgress(2)
    expect(h.progress).toBe(1)
    h.cancel()
  })

  it("ignores setProgress after cancel in push mode", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const h = scrub(def, [target as never])
    h.setProgress(0.5)
    h.cancel()
    h.setProgress(0.9)
    expect(target.written["opacity"]).toBe("0.5")
  })

  it("invokes onProgress callback on each apply", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const seen: number[] = []
    const h = scrub(def, [target as never], {
      onProgress: (p) => seen.push(p),
    })
    h.setProgress(0.25)
    h.setProgress(0.75)
    expect(seen).toEqual([0.25, 0.75])
    h.cancel()
  })

  it("pull-mode polls source via raf and applies progress", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    let pending: ((time: number) => void) | null = null
    let cancelled = false
    let progressSource = 0
    const h = scrub(def, [target as never], {
      source: () => progressSource,
      raf: (cb: (time: number) => void) => {
        pending = cb
        return 1
      },
      cancelRaf: () => {
        cancelled = true
      },
    })
    progressSource = 0.4
    ;(pending as ((time: number) => void) | null)?.(0)
    expect(target.written["opacity"]).toBe("0.4")
    progressSource = 0.7
    ;(pending as ((time: number) => void) | null)?.(0)
    expect(target.written["opacity"]).toBe("0.7")
    h.cancel()
    expect(cancelled).toBe(true)
  })

  it("pull-mode setProgress applies and updates progress", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const h = scrub(def, [target as never], {
      source: () => 0,
      raf: () => 1,
      cancelRaf: () => {},
    })
    h.setProgress(0.42)
    expect(target.written["opacity"]).toBe("0.42")
    expect(h.progress).toBe(0.42)
    h.cancel()
  })

  it("pull-mode tick after cancel is a no-op and does not reschedule", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    let pending: ((time: number) => void) | null = null
    let rafCalls = 0
    const h = scrub(def, [target as never], {
      source: () => 0.5,
      raf: (cb: (time: number) => void) => {
        rafCalls++
        pending = cb
        return rafCalls
      },
      cancelRaf: () => {},
    })
    expect(rafCalls).toBe(1)
    h.cancel()
    const before = rafCalls
    ;(pending as ((time: number) => void) | null)?.(0)
    // After cancel the tick returns immediately and does not request another frame
    expect(rafCalls).toBe(before)
  })

  it("exposes state and progress getters in pull mode", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const h = scrub(def, [target as never], {
      source: () => 0,
      raf: () => 1,
      cancelRaf: () => {},
    })
    expect(h.state).toBe("active")
    expect(h.progress).toBe(0)
    h.setProgress(0.5)
    expect(h.progress).toBe(0.5)
    h.cancel()
    expect(h.state).toBe("cancelled")
  })

  it("exposes state getter in push mode", () => {
    const target = mkTarget()
    const def = tween({ opacity: [0, 1] })
    const h = scrub(def, [target as never])
    expect(h.state).toBe("active")
    h.cancel()
    expect(h.state).toBe("cancelled")
  })

  it("falls back to setTimeout when rAF is unavailable in pull mode", () => {
    vi.useFakeTimers()
    try {
      const target = mkTarget()
      const def = tween({ opacity: [0, 1] })
      let p = 0
      const h = scrub(def, [target as never], { source: () => p })
      p = 0.6
      vi.advanceTimersByTime(20)
      expect(target.written["opacity"]).toBe("0.6")
      h.cancel()
      // After cancel no further timeout fires apply
      p = 0.9
      vi.advanceTimersByTime(40)
      expect(target.written["opacity"]).toBe("0.6")
    } finally {
      vi.useRealTimers()
    }
  })
})
