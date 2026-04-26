// @vitest-environment happy-dom

// Memory-leak audit. Asserts that fire-and-forget cancel of N animations
// leaves the tracker map empty, the global frame scheduler not running,
// and the WAAPI mock free of stranded `Animation` objects. Re-run after
// each refactor that touches lifecycle (handle wrapping, lazy promises,
// the keepalive list, etc.) to catch silent retention bugs.

import { afterEach, describe, expect, it } from "vitest"
import { play } from "./api/play"
import { tween } from "./api/tween"
import { __resetTracker, enableTracker, listActive } from "./devtools/tracker"
import { frame as defaultScheduler } from "./scheduler/frame"

afterEach(() => {
  __resetTracker()
  // Drain any leftover scheduler state so it doesn't bleed into the
  // next test's `isRunning` assertion.
  defaultScheduler.flushSync()
})

interface MockAnimation {
  pause: () => void
  play: () => void
  cancel: () => void
  finish: () => void
  reverse: () => void
  currentTime: number
  playbackRate: number
  finished: Promise<void>
  onfinish: ((ev: unknown) => void) | null
  oncancel: ((ev: unknown) => void) | null
}

function makeTarget(): {
  style: { setProperty: (n: string, v: string) => void }
  setAttribute: () => void
  animate: () => MockAnimation
  animations: MockAnimation[]
  liveCount: number
} {
  const animations: MockAnimation[] = []
  let liveCount = 0
  return {
    style: { setProperty: () => {} },
    setAttribute: () => {},
    animate() {
      liveCount++
      const a: MockAnimation = {
        pause: () => {},
        play: () => {},
        cancel: () => {
          liveCount--
        },
        finish: () => {},
        reverse: () => {},
        currentTime: 0,
        playbackRate: 1,
        finished: Promise.resolve(),
        onfinish: null,
        oncancel: null,
      }
      animations.push(a)
      return a
    },
    animations,
    get liveCount() {
      return liveCount
    },
  }
}

describe("no leaks: fire-and-forget cancel", () => {
  it("tracker active map is empty after cancel of N plays", async () => {
    enableTracker()
    expect(listActive().length).toBe(0)
    const targets = Array.from({ length: 200 }, () => makeTarget())
    const handles = targets.map((t) =>
      play(tween({ opacity: [0, 1], x: [0, 100] }, { duration: 1000 }), t),
    )
    expect(listActive().length).toBe(200)
    for (const h of handles) h.cancel()
    // Tracker drops the record on the cancel rejection callback, which
    // runs as a microtask. Yield once to flush.
    await Promise.resolve()
    expect(listActive().length).toBe(0)
  })

  it("global frame scheduler stops running after all plays cancel (mode: main)", async () => {
    const targets = Array.from({ length: 50 }, () => makeTarget())
    const handles = targets.map((t) =>
      play(tween({ opacity: [0, 1] }, { duration: 1000 }), t, { mode: "main" }),
    )
    // The scheduler may not have ticked yet; but it should be running.
    expect(defaultScheduler.isRunning).toBe(true)
    for (const h of handles) h.cancel()
    // Scheduler tears itself down on the next tick after work hits zero.
    // Force one synchronous tick so the keepalive sweep runs.
    defaultScheduler.flushSync()
    expect(defaultScheduler.isRunning).toBe(false)
  })

  it("WAAPI mock animations are all cancelled when handles cancel", async () => {
    const targets = Array.from({ length: 50 }, () => makeTarget())
    const handles = targets.map((t) =>
      play(tween({ opacity: [0, 1] }, { duration: 1000 }), t, {
        backend: "waapi",
        waapiSupported: true,
        lazy: false,
      }),
    )
    // With lazy:false + backend=waapi, animate() fires synchronously
    // for every play.
    const totalLive = targets.reduce((sum, t) => sum + t.liveCount, 0)
    expect(totalLive).toBe(50)
    for (const h of handles) h.cancel()
    const totalAfter = targets.reduce((sum, t) => sum + t.liveCount, 0)
    expect(totalAfter).toBe(0)
  })

  it("reduced-motion snap leaves no scheduler work", async () => {
    const targets = Array.from({ length: 50 }, () => makeTarget())
    for (const t of targets) {
      play(tween({ opacity: [0, 1] }, { duration: 1000 }), t, { reducedMotion: "always" })
    }
    expect(defaultScheduler.isRunning).toBe(false)
    // Snap commits values; nothing in the WAAPI mock should be live.
    expect(targets.reduce((sum, t) => sum + t.liveCount, 0)).toBe(0)
  })
})
