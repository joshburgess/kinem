import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { play } from "../api/play"
import { tween } from "../api/tween"
import type { StrategyTarget } from "../render/strategy"
import {
  type AmbientHandle,
  __resetTracker,
  enableTracker,
  listActive,
  subscribe,
  trackAmbient,
  trackAnimation,
  untrackAmbient,
} from "./tracker"

function fakeTarget(): StrategyTarget {
  return {
    style: { setProperty() {} },
    setAttribute() {},
    animate() {
      return {
        pause() {},
        play() {},
        cancel() {},
        finish() {},
        reverse() {},
        currentTime: 0,
        playbackRate: 1,
        finished: Promise.resolve(),
        onfinish: null,
        oncancel: null,
      }
    },
  } as unknown as StrategyTarget
}

beforeEach(() => {
  // Most of the suite assumes tracking is on. The opt-in default is
  // tested explicitly in the "disabled by default" case below.
  enableTracker()
})

afterEach(() => {
  __resetTracker()
})

describe("tracker", () => {
  it("listActive() is empty until something happens", () => {
    expect(listActive()).toHaveLength(0)
  })

  it("is disabled by default so play() pays nothing when devtools is absent", () => {
    __resetTracker()
    const def = tween({ opacity: [0, 1] }, { duration: 1 })
    play(def, [fakeTarget()], { backend: "raf" })
    expect(listActive()).toHaveLength(0)
  })

  it("play() registers an animation and removes it on finish (when enabled)", async () => {
    const def = tween({ opacity: [0, 1] }, { duration: 1 })
    const controls = play(def, [fakeTarget()], { backend: "raf" })
    expect(listActive().length).toBeGreaterThan(0)
    await controls.finished
    expect(listActive()).toHaveLength(0)
  })

  it("subscribe receives start then finish events", async () => {
    const events: string[] = []
    const off = subscribe((e) => events.push(e.type))
    const def = tween({ opacity: [0, 1] }, { duration: 1 })
    const controls = play(def, [fakeTarget()], { backend: "raf" })
    await controls.finished
    off()
    expect(events[0]).toBe("start")
    expect(events.at(-1)).toBe("finish")
  })

  it("emits cancel when the tracked controls.finished rejects", async () => {
    const events: Array<{ type: string; id: number }> = []
    const off = subscribe((e) => events.push({ type: e.type, id: e.id }))
    let reject!: (err: unknown) => void
    const finished = new Promise<void>((_res, rej) => {
      reject = rej
    })
    const controls = { state: "playing" as const, duration: 1000, finished }
    trackAnimation(controls as never, [fakeTarget()])
    reject(new Error("cancelled"))
    await finished.catch(() => {})
    off()
    expect(events.map((e) => e.type)).toEqual(["start", "cancel"])
    expect(listActive()).toHaveLength(0)
  })

  it("unsubscribe stops further notifications", async () => {
    const events: string[] = []
    const off = subscribe((e) => events.push(e.type))
    off()
    const def = tween({ opacity: [0, 1] }, { duration: 1 })
    const controls = play(def, [fakeTarget()], { backend: "raf" })
    await controls.finished
    expect(events).toHaveLength(0)
  })

  it("record exposes live state and progress", () => {
    const controls = {
      state: "playing" as const,
      duration: 1000,
      finished: new Promise<void>(() => {}),
    }
    trackAnimation(controls as never, [fakeTarget()])
    const [record] = listActive()
    if (!record) throw new Error("no record")
    expect(record.state).toBe("playing")
    expect(record.progress).toBeGreaterThanOrEqual(0)
    expect(record.progress).toBeLessThanOrEqual(1)
  })

  it("progress reports 1 when duration is zero", () => {
    const controls = {
      state: "playing" as const,
      duration: 0,
      finished: new Promise<void>(() => {}),
    }
    trackAnimation(controls as never, [fakeTarget()])
    const [record] = listActive()
    if (!record) throw new Error("no record")
    expect(record.progress).toBe(1)
  })

  it("installs __KINEM_DEVTOOLS_HOOK__ on the global when enabled", () => {
    __resetTracker()
    expect(
      (globalThis as { __KINEM_DEVTOOLS_HOOK__?: unknown }).__KINEM_DEVTOOLS_HOOK__,
    ).toBeUndefined()
    enableTracker()
    const hook = (globalThis as { __KINEM_DEVTOOLS_HOOK__?: { version: number } })
      .__KINEM_DEVTOOLS_HOOK__
    expect(hook).toBeDefined()
    expect(hook?.version).toBe(1)
  })

  it("emits nothing when no listeners are attached (doesn't throw)", () => {
    const spy = vi.fn()
    const controls = {
      state: "playing" as const,
      duration: 100,
      finished: new Promise<void>(() => {}),
    }
    expect(() => trackAnimation(controls as never, [fakeTarget()])).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it("trackAmbient registers an open-ended record with duration 0", () => {
    const handle: AmbientHandle = {
      cancel() {},
      state: "active",
      progress: 0.42,
    }
    trackAmbient(handle, "follow", [fakeTarget()])
    const [record] = listActive()
    if (!record) throw new Error("no record")
    expect(record.duration).toBe(0)
    expect(record.backend).toBe("follow")
    expect(record.state).toBe("playing")
    expect(record.progress).toBeCloseTo(0.42)
  })

  it("trackAmbient is a no-op when tracking is disabled", () => {
    __resetTracker()
    const handle: AmbientHandle = { cancel() {}, state: "active" }
    expect(trackAmbient(handle, "scrub")).toBe(-1)
    expect(listActive()).toHaveLength(0)
  })

  it("ambient controls.cancel() removes the record and forwards to the handle", async () => {
    let cancelled = false
    const handle: AmbientHandle = {
      cancel() {
        cancelled = true
      },
      state: "active",
    }
    trackAmbient(handle, "scroll")
    const [record] = listActive()
    if (!record) throw new Error("no record")
    expect(listActive()).toHaveLength(1)
    record.controls.cancel()
    expect(cancelled).toBe(true)
    // tracker awaits the façade's `finished` promise to remove the
    // record; let microtasks drain.
    await Promise.resolve()
    await Promise.resolve()
    expect(listActive()).toHaveLength(0)
  })

  it("ambient controls.pause/resume/seek are no-ops (don't throw)", () => {
    const handle: AmbientHandle = { cancel() {}, state: "active" }
    trackAmbient(handle, "ambient")
    const [record] = listActive()
    if (!record) throw new Error("no record")
    expect(() => {
      record.controls.pause()
      record.controls.resume()
      record.controls.seek(0.5)
      record.controls.reverse()
      record.controls.restart()
    }).not.toThrow()
  })

  it("untrackAmbient removes the record and emits cancel without invoking the handle", () => {
    const events: string[] = []
    const off = subscribe((e) => events.push(e.type))
    let cancelled = false
    const handle: AmbientHandle = {
      cancel() {
        cancelled = true
      },
      state: "active",
    }
    const id = trackAmbient(handle, "follow")
    expect(listActive()).toHaveLength(1)
    untrackAmbient(id)
    off()
    expect(listActive()).toHaveLength(0)
    // untrackAmbient does NOT call handle.cancel(); the primitive is
    // expected to invoke this in its own cancel path, after it has
    // already torn down its own state.
    expect(cancelled).toBe(false)
    expect(events).toEqual(["start", "cancel"])
  })

  it("untrackAmbient is a no-op for unknown / negative ids", () => {
    expect(() => untrackAmbient(-1)).not.toThrow()
    expect(() => untrackAmbient(9999)).not.toThrow()
  })

  it("ambient subscribers see start then cancel events", async () => {
    const events: string[] = []
    const off = subscribe((e) => events.push(e.type))
    const handle: AmbientHandle = { cancel() {}, state: "active" }
    trackAmbient(handle, "follow")
    const [record] = listActive()
    if (!record) throw new Error("no record")
    record.controls.cancel()
    await Promise.resolve()
    await Promise.resolve()
    off()
    expect(events).toEqual(["start", "cancel"])
  })
})
