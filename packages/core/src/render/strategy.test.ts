import { describe, expect, it, vi } from "vitest"
import { tween } from "../api/tween"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import {
  type StrategyHandle,
  type StrategyTarget,
  combineHandles,
  discoverProperties,
  playStrategy as play,
} from "./strategy"
import type { Animatable, WaapiAnimation } from "./waapi"

function mockHandle(): StrategyHandle & {
  resolveFinished: () => void
  rejectFinished: (err: unknown) => void
} {
  let resolveFinished!: () => void
  let rejectFinished!: (err: unknown) => void
  const finished = new Promise<void>((res, rej) => {
    resolveFinished = res
    rejectFinished = rej
  })
  return {
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    reverse: vi.fn(),
    setSpeed: vi.fn(),
    cancel: vi.fn(),
    state: "playing" as const,
    finished,
    resolveFinished,
    rejectFinished,
  }
}

function mockAnimation(): WaapiAnimation & {
  fireFinish: () => void
  fireCancel: () => void
} {
  let onfinish: ((ev: unknown) => void) | null = null
  let oncancel: ((ev: unknown) => void) | null = null
  const a: WaapiAnimation & { fireFinish: () => void; fireCancel: () => void } = {
    pause: vi.fn(),
    play: vi.fn(),
    cancel: vi.fn(),
    finish: vi.fn(),
    reverse: vi.fn(),
    currentTime: 0,
    playbackRate: 1,
    finished: Promise.resolve(),
    get onfinish() {
      return onfinish
    },
    set onfinish(v) {
      onfinish = v as ((ev: unknown) => void) | null
    },
    get oncancel() {
      return oncancel
    },
    set oncancel(v) {
      oncancel = v as ((ev: unknown) => void) | null
    },
    fireFinish: () => onfinish?.({}),
    fireCancel: () => oncancel?.({}),
  }
  return a
}

function mockTarget(): StrategyTarget & {
  animations: ReturnType<typeof mockAnimation>[]
  styles: Map<string, string>
  lastKeyframes: Keyframe[] | null
} {
  const animations: ReturnType<typeof mockAnimation>[] = []
  const styles = new Map<string, string>()
  let lastKeyframes: Keyframe[] | null = null
  return {
    animations,
    styles,
    get lastKeyframes() {
      return lastKeyframes
    },
    style: {
      setProperty(name, value) {
        styles.set(name, value)
      },
    },
    setAttribute() {},
    animate(keyframes) {
      lastKeyframes = keyframes as unknown as Keyframe[]
      const a = mockAnimation()
      animations.push(a)
      return a
    },
  }
}

type Keyframe = Record<string, unknown>

function mockRaf() {
  let nextId = 1
  const pending = new Map<number, (t: number) => void>()
  const raf: RafLike = {
    request(cb) {
      const id = nextId++
      pending.set(id, cb)
      return id
    },
    cancel(id) {
      pending.delete(id)
    },
  }
  return {
    raf,
    fire(time: number) {
      const entry = [...pending].at(-1)
      if (!entry) return
      const [id, cb] = entry
      pending.delete(id)
      cb(time)
    },
  }
}

describe("discoverProperties", () => {
  it("returns the union of keys at t=0 and t=1", () => {
    const def = tween({ opacity: [0, 1], width: ["0px", "100px"] }, { duration: 100 })
    const props = [...discoverProperties(def)]
    expect(props.sort()).toEqual(["opacity", "width"])
  })

  it("uses the cached `properties` list without sampling when present", () => {
    const interpolate = vi.fn(() => ({ opacity: 1 }))
    const def = {
      duration: 100,
      easing: (p: number) => p,
      interpolate,
      properties: ["opacity", "transform"],
    }
    const props = discoverProperties(def)
    expect(props).toEqual(["opacity", "transform"])
    expect(interpolate).not.toHaveBeenCalled()
  })
})

describe("play: strategy router", () => {
  it("routes compositor-safe props to WAAPI and main-thread props to rAF", () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    play(tween({ opacity: [0, 1], width: ["0px", "100px"] }, { duration: 100 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
      backend: "auto",
    })
    expect(t.animations).toHaveLength(1)
    // WAAPI keyframes should contain opacity but not width.
    const kf = t.lastKeyframes![0]!
    expect("opacity" in kf).toBe(true)
    expect("width" in kf).toBe(false)
    // The rAF side should drive width on tick.
    r.fire(0)
    expect(t.styles.has("width")).toBe(true)
    expect(t.styles.has("opacity")).toBe(false)
  })

  it("falls back to rAF-only when WAAPI is unsupported", () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    play(tween({ opacity: [0, 1], width: ["0px", "100px"] }, { duration: 100 }), [t], {
      waapiSupported: false,
      scheduler,
      clock,
    })
    expect(t.animations).toHaveLength(0)
    r.fire(0)
    expect(t.styles.has("opacity")).toBe(true)
    expect(t.styles.has("width")).toBe(true)
  })

  it("applies will-change to compositor props and clears on finish", async () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1] }, { duration: 50 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    expect(t.styles.get("will-change")).toBe("opacity")
    t.animations[0]!.fireFinish()
    await h.finished
    expect(t.styles.get("will-change")).toBe("auto")
  })

  it("clears will-change when the user cancels", async () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1] }, { duration: 50 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    expect(t.styles.get("will-change")).toBe("opacity")
    h.cancel()
    await expect(h.finished).rejects.toThrow(/cancelled/)
    expect(t.styles.get("will-change")).toBe("auto")
  })

  it("clears will-change when a sub-handle rejects on its own", async () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1], width: ["0px", "10px"] }, { duration: 50 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    expect(t.styles.get("will-change")).toBe("opacity")
    // Directly cancel the WAAPI sub-animation to simulate a backend failure.
    t.animations[0]!.fireCancel()
    await expect(h.finished).rejects.toThrow(/cancelled/)
    expect(t.styles.get("will-change")).toBe("auto")
  })

  it("pause/resume/cancel propagate to both sub-handles", () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1], width: ["0px", "50px"] }, { duration: 100 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    h.pause()
    expect(h.state).toBe("paused")
    expect(t.animations[0]!.pause).toHaveBeenCalled()
    h.resume()
    expect(h.state).toBe("playing")
    h.cancel()
    void h.finished.catch(() => {})
    expect(h.state).toBe("cancelled")
    expect(t.animations[0]!.cancel).toHaveBeenCalled()
  })

  it("backend: 'raf' forces rAF even when WAAPI is available", () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    play(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {
      waapiSupported: true,
      backend: "raf",
      scheduler,
      clock,
    })
    expect(t.animations).toHaveLength(0)
    r.fire(0)
    expect(t.styles.has("opacity")).toBe(true)
  })

  it("seek propagates to both backends", () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1], width: ["0px", "100px"] }, { duration: 400 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    h.pause()
    h.seek(0.25)
    expect(t.animations[0]!.currentTime).toBe(100)
    r.fire(0)
    expect(t.styles.get("width")).toBe("25px")
  })
})

describe("combineHandles: single-handle fast path", () => {
  it("returns the handle directly when there is no cleanup", () => {
    const h = mockHandle()
    const combined = combineHandles([h])
    expect(combined).toBe(h)
  })

  it("wraps the handle when cleanup is supplied, runs cleanup on finish", async () => {
    const h = mockHandle()
    const cleanup = vi.fn()
    const combined = combineHandles([h], cleanup)
    expect(combined).not.toBe(h)
    combined.pause()
    expect(h.pause).toHaveBeenCalled()
    h.resolveFinished()
    await combined.finished
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("runs cleanup and preserves rejection on cancel", async () => {
    const h = mockHandle()
    const cleanup = vi.fn()
    const combined = combineHandles([h], cleanup)
    const err = new Error("animation cancelled")
    h.rejectFinished(err)
    await expect(combined.finished).rejects.toBe(err)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
