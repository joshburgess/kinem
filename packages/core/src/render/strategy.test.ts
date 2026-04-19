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
    progress: 0,
    direction: 1 as const,
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
    // First tick: lazy WAAPI setup runs in the update phase; rAF backend
    // commits in render. Both need a frame before they touch the DOM.
    r.fire(0)
    expect(t.animations).toHaveLength(1)
    const kf = t.lastKeyframes![0]!
    expect("opacity" in kf).toBe(true)
    expect("width" in kf).toBe(false)
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
    r.fire(0)
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

  it("cancel before the first frame skips WAAPI setup entirely", async () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    h.cancel()
    await expect(h.finished).rejects.toThrow(/cancelled/)
    r.fire(0)
    expect(t.animations).toHaveLength(0)
  })

  it("pause queued before the first frame replays onto the inner handle", () => {
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {
      waapiSupported: true,
      scheduler,
      clock,
    })
    h.pause()
    expect(h.state).toBe("paused")
    r.fire(0)
    expect(t.animations[0]!.pause).toHaveBeenCalled()
    expect(h.state).toBe("paused")
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

  it("backend: 'raf' cancel-before-first writes no styles", () => {
    // rAF setup is eager (see the 'why no wrapRaf' note in strategy.ts),
    // so createTiming does run. But cancel() disarms the compute/update
    // ticks before the first scheduler frame fires, so no style commit
    // happens.
    const t = mockTarget()
    const r = mockRaf()
    const now = 0
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => now })
    const clock = createClock({ now: () => now })
    const h = play(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {
      waapiSupported: true,
      backend: "raf",
      scheduler,
      clock,
    })
    h.cancel()
    r.fire(0)
    expect(t.styles.has("opacity")).toBe(false)
    expect(h.state).toBe("cancelled")
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
    // Lazy WAAPI: the sub-animation is built on the first tick; the
    // queued seek replays onto it, and the rAF backend commits in the
    // render phase of the same frame.
    r.fire(0)
    expect(t.animations[0]!.currentTime).toBe(100)
    expect(t.styles.get("width")).toBe("25px")
  })
})

describe("combineHandles: single-handle fast path", () => {
  it("returns the single handle directly", () => {
    const h = mockHandle()
    const combined = combineHandles([h])
    expect(combined).toBe(h)
  })
})

describe("combineHandles: derived state", () => {
  function stateMock(): StrategyHandle & { _setState: (s: StrategyHandle["state"]) => void } {
    let state: StrategyHandle["state"] = "playing"
    return {
      pause: vi.fn(() => {
        state = "paused"
      }),
      resume: vi.fn(() => {
        state = "playing"
      }),
      seek: vi.fn(),
      reverse: vi.fn(),
      setSpeed: vi.fn(),
      cancel: vi.fn(() => {
        state = "cancelled"
      }),
      get state() {
        return state
      },
      progress: 0,
      direction: 1 as const,
      finished: new Promise(() => {}),
      _setState(s) {
        state = s
      },
    }
  }

  it("reports 'playing' while any child is playing", () => {
    const a = stateMock()
    const b = stateMock()
    const combined = combineHandles([a, b])
    expect(combined.state).toBe("playing")
    a._setState("finished")
    expect(combined.state).toBe("playing")
  })

  it("reports 'finished' when all children are finished", () => {
    const a = stateMock()
    const b = stateMock()
    const combined = combineHandles([a, b])
    a._setState("finished")
    b._setState("finished")
    expect(combined.state).toBe("finished")
  })

  it("re-derives 'playing' when children un-finish via seek/reverse", () => {
    const a = stateMock()
    const b = stateMock()
    // Seek/reverse on the child flips its state back to playing (mirrors
    // Timing.seek and WaapiImpl.seek re-arming from finished). Without
    // derived state, combined would report stale 'finished' while the
    // animation runs visibly. This is the scroll-triggered zombie bug.
    a.seek = vi.fn(() => a._setState("playing"))
    b.seek = vi.fn(() => b._setState("playing"))
    const combined = combineHandles([a, b])
    a._setState("finished")
    b._setState("finished")
    expect(combined.state).toBe("finished")
    combined.seek(0)
    expect(combined.state).toBe("playing")
  })

  it("cancel is sticky: state stays 'cancelled' even if a child reports otherwise", () => {
    const a = stateMock()
    const b = stateMock()
    const combined = combineHandles([a, b])
    combined.cancel()
    expect(combined.state).toBe("cancelled")
    // Even if a stale child reports playing, cancelled sticks.
    a._setState("playing")
    expect(combined.state).toBe("cancelled")
  })

  it("propagates seek/reverse/setSpeed regardless of derived 'finished' state", () => {
    // Critical for scroll-triggered: after all children finish, user-driven
    // reverse must still propagate so children can re-arm.
    const a = stateMock()
    const b = stateMock()
    const combined = combineHandles([a, b])
    a._setState("finished")
    b._setState("finished")
    combined.seek(0.5)
    combined.reverse()
    combined.setSpeed(2)
    expect(a.seek).toHaveBeenCalledWith(0.5)
    expect(b.seek).toHaveBeenCalledWith(0.5)
    expect(a.reverse).toHaveBeenCalled()
    expect(b.reverse).toHaveBeenCalled()
    expect(a.setSpeed).toHaveBeenCalledWith(2)
  })
})
