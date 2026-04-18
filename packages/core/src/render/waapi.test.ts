import { describe, expect, it, vi } from "vitest"
import { tween } from "../api/tween"
import { cubicBezier, easeOut } from "../core/easing"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import { type Animatable, type WaapiAnimation, buildKeyframes, playWaapi } from "./waapi"

function mockAnimation(): WaapiAnimation & {
  onfinishFire: () => void
  oncancelFire: () => void
} {
  let onfinish: ((ev: unknown) => void) | null = null
  let oncancel: ((ev: unknown) => void) | null = null
  const anim: WaapiAnimation = {
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
      onfinish = v
    },
    get oncancel() {
      return oncancel
    },
    set oncancel(v) {
      oncancel = v
    },
  }
  return Object.assign(anim, {
    onfinishFire: () => onfinish?.({}),
    oncancelFire: () => oncancel?.({}),
  })
}

function mockTarget(): Animatable & { animations: WaapiAnimation[]; lastCall: unknown } {
  const animations: WaapiAnimation[] = []
  let lastCall: unknown = null
  return {
    animations,
    get lastCall() {
      return lastCall
    },
    animate(keyframes, options) {
      const anim = mockAnimation()
      animations.push(anim)
      lastCall = { keyframes, options }
      return anim
    },
  }
}

describe("buildKeyframes", () => {
  it("emits offsets spanning 0..1 inclusive", () => {
    const def = tween({ opacity: [0, 1] }, { duration: 100 })
    const frames = buildKeyframes(def)
    expect(frames.length).toBeGreaterThanOrEqual(5)
    expect(frames[0]!.offset).toBe(0)
    expect(frames.at(-1)!.offset).toBe(1)
  })

  it("pre-samples easing into values so WAAPI can run linear timing", () => {
    const def = tween({ opacity: [0, 1] }, { duration: 100, easing: easeOut })
    const frames = buildKeyframes(def, { minSamples: 3, maxSamples: 3 })
    // Middle frame should be past 0.5 because easeOut front-loads progress.
    const mid = frames[1]!
    const opacity = mid["opacity"]
    const op = typeof opacity === "number" ? opacity : Number(opacity)
    expect(op).toBeGreaterThan(0.5)
  })

  it("uses camelCase CSS property names for WAAPI", () => {
    const def = tween({ backgroundColor: ["#000000", "#ffffff"] }, { duration: 100 })
    const frames = buildKeyframes(def, { minSamples: 2, maxSamples: 2 })
    expect(frames[0]!).toHaveProperty("backgroundColor")
    expect(frames[0]!).not.toHaveProperty("background-color")
  })

  it("composes pseudo transform props into a single transform string", () => {
    const def = tween({ x: [0, 100], scale: [1, 2] }, { duration: 100 })
    const frames = buildKeyframes(def, { minSamples: 2, maxSamples: 2 })
    const last = frames[1]!
    expect(typeof last.transform).toBe("string")
    expect(last.transform).toContain("translateX(100px)")
    expect(last.transform).toContain("scale(2)")
    expect(last["x"]).toBeUndefined()
  })

  it("respects explicit transform when no pseudo props are set", () => {
    const def = tween({ transform: ["translateX(0)", "translateX(50px)"] }, { duration: 100 })
    const frames = buildKeyframes(def, { minSamples: 2, maxSamples: 2 })
    expect(typeof frames[0]!.transform).toBe("string")
  })

  it("sample count respects min/max bounds", () => {
    const short = tween({ x: [0, 1] }, { duration: 10 })
    expect(buildKeyframes(short).length).toBe(5)
    const long = tween({ x: [0, 1] }, { duration: 10_000 })
    expect(buildKeyframes(long, { maxSamples: 50 }).length).toBe(50)
  })
})

describe("playWaapi", () => {
  it("calls animate on every target", () => {
    const a = mockTarget()
    const b = mockTarget()
    playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [a, b])
    expect(a.animations).toHaveLength(1)
    expect(b.animations).toHaveLength(1)
  })

  it("passes duration and linear easing to WAAPI", () => {
    const t = mockTarget()
    playWaapi(tween({ opacity: [0, 1] }, { duration: 250 }), [t])
    const call = t.lastCall as { options: { duration: number; easing: string } }
    expect(call.options.duration).toBe(250)
    expect(call.options.easing).toBe("linear")
  })

  it("pause/resume proxies to underlying animations", () => {
    const t = mockTarget()
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t])
    h.pause()
    expect(t.animations[0]!.pause).toHaveBeenCalled()
    expect(h.state).toBe("paused")
    h.resume()
    expect(t.animations[0]!.play).toHaveBeenCalled()
    expect(h.state).toBe("playing")
  })

  it("seek sets currentTime to progress * duration", () => {
    const t = mockTarget()
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 400 }), [t])
    h.seek(0.5)
    expect(t.animations[0]!.currentTime).toBe(200)
  })

  it("resolves `finished` after onfinish fires on every target", async () => {
    const a = mockTarget()
    const b = mockTarget()
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [a, b])
    ;(a.animations[0] as ReturnType<typeof mockAnimation>).onfinishFire()
    expect(h.state).toBe("playing")
    ;(b.animations[0] as ReturnType<typeof mockAnimation>).onfinishFire()
    await h.finished
    expect(h.state).toBe("finished")
  })

  it("cancel rejects finished and cancels all animations", async () => {
    const t = mockTarget()
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t])
    h.cancel()
    expect(t.animations[0]!.cancel).toHaveBeenCalled()
    await expect(h.finished).rejects.toThrow(/cancelled/)
  })

  it("emits 2 keyframes + CSS timing for linearizable tweens", () => {
    const t = mockTarget()
    const easing = cubicBezier(0.4, 0, 0.2, 1)
    playWaapi(tween({ opacity: [0, 1], x: [0, 100] }, { duration: 500, easing }), [t])
    const call = t.lastCall as { keyframes: unknown[]; options: { easing: string } }
    expect(call.keyframes.length).toBe(2)
    expect(call.options.easing).toBe("cubic-bezier(0.4, 0, 0.2, 1)")
  })

  it("falls back to dense sampling for non-linearizable tweens", () => {
    const t = mockTarget()
    // Easeout is quadratic, not a tagged CSS cubic-bezier, so we sample.
    playWaapi(tween({ opacity: [0, 1] }, { duration: 500, easing: easeOut }), [t])
    const call = t.lastCall as { keyframes: unknown[]; options: { easing: string } }
    expect(call.keyframes.length).toBeGreaterThan(2)
    expect(call.options.easing).toBe("linear")
  })

  it("falls back to dense sampling when values are not plain numbers", () => {
    const t = mockTarget()
    // Unit string pairs aren't marked linearizable even under `linear`.
    playWaapi(tween({ width: ["0px", "100px"] }, { duration: 500 }), [t])
    const call = t.lastCall as { keyframes: unknown[]; options: { easing: string } }
    expect(call.keyframes.length).toBeGreaterThan(2)
    expect(call.options.easing).toBe("linear")
  })
})

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

describe("playWaapi: lazy setup", () => {
  it("defers animate() until the first scheduler tick", () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {}, scheduler)
    expect(t.animations).toHaveLength(0)
    r.fire(0)
    expect(t.animations).toHaveLength(1)
  })

  it("cancel before the first tick skips animate() entirely", async () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {}, scheduler)
    h.cancel()
    r.fire(0)
    expect(t.animations).toHaveLength(0)
    await expect(h.finished).rejects.toThrow(/cancelled/)
  })

  it("pause before the first tick pauses the installed animations", () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {}, scheduler)
    h.pause()
    r.fire(0)
    expect(t.animations[0]!.pause).toHaveBeenCalled()
    expect(h.state).toBe("paused")
  })

  it("reverse before the first tick applies playbackRate=-1 on install", () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {}, scheduler)
    h.reverse()
    r.fire(0)
    expect(t.animations[0]!.playbackRate).toBe(-1)
    expect(h.direction).toBe(-1)
  })

  it("setSpeed before the first tick applies the multiplier on install", () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {}, scheduler)
    h.setSpeed(2)
    r.fire(0)
    expect(t.animations[0]!.playbackRate).toBe(2)
  })

  it("combines reverse + setSpeed applied pre-setup into a signed rate", () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 100 }), [t], {}, scheduler)
    h.reverse()
    h.setSpeed(0.5)
    r.fire(0)
    expect(t.animations[0]!.playbackRate).toBe(-0.5)
  })

  it("seek before the first tick replays onto the installed animations", () => {
    const t = mockTarget()
    const r = mockRaf()
    const scheduler = createFrameScheduler({ raf: r.raf, now: () => 0 })
    const h = playWaapi(tween({ opacity: [0, 1] }, { duration: 400 }), [t], {}, scheduler)
    h.pause()
    h.seek(0.25)
    r.fire(0)
    expect(t.animations[0]!.currentTime).toBe(100)
  })
})
