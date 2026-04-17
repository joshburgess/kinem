import { afterEach, describe, expect, it, vi } from "vitest"
import { play } from "../api/play"
import { tween } from "../api/tween"
import type { StrategyTarget } from "../render/strategy"
import { __resetTracker, listActive, subscribe, trackAnimation } from "./tracker"

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

afterEach(() => {
  __resetTracker()
})

describe("tracker", () => {
  it("listActive() is empty by default", () => {
    expect(listActive()).toHaveLength(0)
  })

  it("play() registers an animation and removes it on finish", async () => {
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
})
