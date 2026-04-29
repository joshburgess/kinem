import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  __resetTracker,
  enableTracker,
  listActive,
  subscribe,
} from "../devtools/tracker"
import {
  type ViewTransitionDocumentLike,
  type ViewTransitionLike,
  playViewTransition,
} from "./view-transition"

interface FakeViewTransition extends ViewTransitionLike {
  resolveFinished(): void
  rejectFinished(err: unknown): void
  skipped: boolean
}

function fakeViewTransition(): FakeViewTransition {
  let resolve: () => void = () => {}
  let reject: (err: unknown) => void = () => {}
  const finished = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  // Avoid unhandled rejection noise for cancel-only tests.
  finished.catch(() => {})
  return {
    finished,
    resolveFinished: resolve,
    rejectFinished: reject,
    skipped: false,
    skipTransition() {
      this.skipped = true
      reject(new Error("skipped"))
    },
  }
}

function fakeDocument(vt: FakeViewTransition): ViewTransitionDocumentLike {
  return {
    startViewTransition(callback) {
      void Promise.resolve().then(callback)
      return vt
    },
  }
}

describe("playViewTransition", () => {
  beforeEach(() => {
    __resetTracker()
  })
  afterEach(() => {
    __resetTracker()
  })

  it("falls back to resolved controls when startViewTransition is unavailable", async () => {
    const mutate = vi.fn()
    const ctl = playViewTransition(mutate, { document: {} })
    expect(ctl.state).toBe("finished")
    expect(ctl.progress).toBe(1)
    expect(mutate).toHaveBeenCalledTimes(1)
    await ctl
  })

  it("invokes the callback through startViewTransition and resolves on finished", async () => {
    const vt = fakeViewTransition()
    const mutate = vi.fn()
    const ctl = playViewTransition(mutate, { document: fakeDocument(vt) })
    expect(ctl.state).toBe("playing")
    expect(ctl.duration).toBe(0)
    vt.resolveFinished()
    await ctl
    expect(ctl.state).toBe("finished")
    expect(ctl.progress).toBe(1)
    await Promise.resolve()
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("cancel() calls skipTransition and reports cancelled state", async () => {
    const vt = fakeViewTransition()
    const ctl = playViewTransition(() => {}, { document: fakeDocument(vt) })
    ctl.cancel()
    expect(vt.skipped).toBe(true)
    expect(ctl.state).toBe("cancelled")
    await ctl.catch(() => {})
  })

  it("registers with the tracker as a view-transition record when tracking is on", async () => {
    enableTracker()
    const events: string[] = []
    const unsub = subscribe((event) => events.push(event.type))

    const vt = fakeViewTransition()
    const ctl = playViewTransition(() => {}, { document: fakeDocument(vt) })
    const active = listActive()
    expect(active).toHaveLength(1)
    expect(active[0]?.backend).toBe("view-transition")

    vt.resolveFinished()
    await ctl
    // tracker `finished` listener runs in a microtask after the await
    await Promise.resolve()
    expect(events).toContain("start")
    expect(events).toContain("finish")
    expect(listActive()).toHaveLength(0)
    unsub()
  })

  it("does not register with the tracker when tracking is disabled", () => {
    const vt = fakeViewTransition()
    playViewTransition(() => {}, { document: fakeDocument(vt) })
    expect(listActive()).toHaveLength(0)
  })

  it("pause / resume / seek / reverse / restart are no-ops", () => {
    const vt = fakeViewTransition()
    const ctl = playViewTransition(() => {}, { document: fakeDocument(vt) })
    expect(ctl.pause()).toBe(ctl)
    expect(ctl.resume()).toBe(ctl)
    expect(ctl.seek(0.5)).toBe(ctl)
    expect(ctl.reverse()).toBe(ctl)
    expect(ctl.restart()).toBe(ctl)
    expect(ctl.state).toBe("playing")
    ctl.cancel()
  })
})
