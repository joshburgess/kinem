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

  it("reports the spring duration when spring is set (no real document)", () => {
    const vt = fakeViewTransition()
    const ctl = playViewTransition(() => {}, {
      document: fakeDocument(vt),
      spring: { stiffness: 200, damping: 20 },
    })
    expect(ctl.duration).toBeGreaterThan(0)
    ctl.cancel()
  })

  function fakeDomDocument(vt: FakeViewTransition): {
    doc: ViewTransitionDocumentLike
    styles: Array<{ textContent: string }>
  } {
    const styles: Array<{ textContent: string }> = []
    const parent = {
      removeChild(node: { textContent: string }) {
        const idx = styles.indexOf(node)
        if (idx >= 0) styles.splice(idx, 1)
      },
    }
    const doc = {
      createElement: () =>
        ({
          setAttribute() {},
          textContent: "",
          parentNode: parent,
        }) as unknown as { textContent: string },
      head: {
        appendChild(node: { textContent: string }) {
          styles.push(node)
          return node
        },
      },
      startViewTransition(callback: () => void) {
        void Promise.resolve().then(callback)
        return vt
      },
    }
    return { doc: doc as unknown as ViewTransitionDocumentLike, styles }
  }

  it("injects a stylesheet with linear() timing when spring is set on a real document", async () => {
    const vt = fakeViewTransition()
    const { doc, styles } = fakeDomDocument(vt)
    const ctl = playViewTransition(() => {}, {
      document: doc,
      spring: { stiffness: 200, damping: 20 },
      springSamples: 8,
    })
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain("linear(")
    expect(styles[0]?.textContent).toContain("animation-duration:")
    expect(styles[0]?.textContent).toContain("::view-transition-group(*)")
    vt.resolveFinished()
    await ctl
    // microtask for the .then() cleanup
    await Promise.resolve()
    expect(styles).toHaveLength(0)
  })

  it("removes the spring stylesheet on cancel", async () => {
    const vt = fakeViewTransition()
    const { doc, styles } = fakeDomDocument(vt)
    const ctl = playViewTransition(() => {}, {
      document: doc,
      spring: { stiffness: 200, damping: 20 },
      springSamples: 6,
    })
    expect(styles).toHaveLength(1)
    ctl.cancel()
    // skipTransition rejects vt.finished; cleanup runs in the rejection handler
    await ctl.catch(() => {})
    await Promise.resolve()
    expect(styles).toHaveLength(0)
  })
})
