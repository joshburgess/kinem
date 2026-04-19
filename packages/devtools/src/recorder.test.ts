import { __resetTracker, trackAnimation } from "kinem"
import { afterEach, describe, expect, it } from "vitest"
import { createRecorder } from "./recorder"

afterEach(() => {
  __resetTracker()
})

function pending(): Promise<void> {
  return new Promise<void>(() => {})
}

describe("createRecorder", () => {
  it("captures start events while recording", () => {
    const rec = createRecorder()
    rec.start()
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "DIV" }] as never,
    )
    const events = rec.flush()
    rec.stop()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: "start", duration: 100 })
  })

  it("captures finish events", async () => {
    const rec = createRecorder()
    rec.start()
    let resolve!: () => void
    const finished = new Promise<void>((res) => {
      resolve = res
    })
    trackAnimation(
      { state: "playing", duration: 10, finished } as never,
      [{ tagName: "DIV" }] as never,
    )
    resolve()
    await finished
    // Microtask flush
    await new Promise((r) => setTimeout(r, 0))
    const events = rec.flush()
    rec.stop()
    expect(events.map((e) => e.type)).toEqual(["start", "finish"])
  })

  it("captures cancel events", async () => {
    const rec = createRecorder()
    rec.start()
    let reject!: (err: unknown) => void
    const finished = new Promise<void>((_res, rej) => {
      reject = rej
    })
    trackAnimation(
      { state: "playing", duration: 10, finished } as never,
      [{ tagName: "DIV" }] as never,
    )
    reject(new Error("cancelled"))
    await finished.catch(() => {})
    const events = rec.flush()
    rec.stop()
    expect(events.map((e) => e.type)).toEqual(["start", "cancel"])
  })

  it("stop() unsubscribes so later events are not recorded", () => {
    const rec = createRecorder()
    rec.start()
    rec.stop()
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "DIV" }] as never,
    )
    expect(rec.flush()).toHaveLength(0)
  })

  it("start() is idempotent", () => {
    const rec = createRecorder()
    rec.start()
    rec.start()
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "DIV" }] as never,
    )
    expect(rec.flush()).toHaveLength(1)
    rec.stop()
  })

  it("flush() clears the buffer", () => {
    const rec = createRecorder()
    rec.start()
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "DIV" }] as never,
    )
    expect(rec.flush()).toHaveLength(1)
    expect(rec.flush()).toHaveLength(0)
    rec.stop()
  })

  it("onEvent callback fires in addition to buffering", () => {
    const streamed: string[] = []
    const rec = createRecorder({ onEvent: (e) => streamed.push(e.type) })
    rec.start()
    trackAnimation(
      { state: "playing", duration: 100, finished: pending() } as never,
      [{ tagName: "DIV" }] as never,
    )
    expect(streamed).toEqual(["start"])
    rec.stop()
  })

  it("isRecording reflects state", () => {
    const rec = createRecorder()
    expect(rec.isRecording).toBe(false)
    rec.start()
    expect(rec.isRecording).toBe(true)
    rec.stop()
    expect(rec.isRecording).toBe(false)
  })
})
