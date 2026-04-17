import { describe, expect, it } from "vitest"
import { createBatch } from "./batch"
import { createFrameScheduler } from "./frame"

/**
 * Simulated element where any `read` after a `write` counts as a
 * forced reflow. This is a faithful proxy for the layout-thrashing
 * behavior real browsers penalize.
 */
class El {
  private v = 0
  private dirty = false
  static reflows = 0
  write(x: number): void {
    this.v = x
    this.dirty = true
  }
  read(): number {
    if (this.dirty) {
      El.reflows++
      this.dirty = false
    }
    return this.v
  }
}

const COUNT = 50

function makeEls(): El[] {
  return Array.from({ length: COUNT }, () => new El())
}

describe("layout-thrashing prevention", () => {
  it("naive interleaved pattern causes one reflow per element", () => {
    const els = makeEls()
    El.reflows = 0
    for (let i = 0; i < COUNT; i++) {
      const el = els[i]!
      el.write(i)
      el.read()
    }
    expect(El.reflows).toBe(COUNT)
  })

  it("batched reads-then-writes causes zero reflows", () => {
    const els = makeEls()
    for (const el of els) el.read()
    El.reflows = 0

    const b = createBatch()
    for (let i = 0; i < COUNT; i++) {
      const el = els[i]!
      b.read(() => el.read())
      b.write(() => el.write(i + 1))
    }
    b.flush()
    expect(El.reflows).toBe(0)
  })

  it("frame scheduler phase order produces zero in-frame reflows", () => {
    const els = makeEls()
    // Prime: make every element clean first.
    for (const el of els) el.read()
    El.reflows = 0

    const s = createFrameScheduler({
      raf: { request: () => 0, cancel: () => {} },
    })
    for (let i = 0; i < COUNT; i++) {
      const el = els[i]!
      s.schedule("read", () => {
        el.read()
      })
      s.schedule("update", () => {
        el.write(i + 1)
      })
    }
    s.flushSync(0)
    expect(El.reflows).toBe(0)
  })
})
