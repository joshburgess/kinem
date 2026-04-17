import { createBatch, createFrameScheduler } from "motif-animate"
import { bench, describe } from "vitest"

/**
 * Simulated DOM element: a `read` after a `write` forces an invalidation
 * pass (the "layout" recompute). We count these transitions as a proxy
 * for thrashing cost. Real browsers do far more work per transition,
 * but this model is faithful to the ordering that triggers it.
 */
class FakeElement {
  private x = 0
  private dirty = false
  static reflows = 0
  write(v: number): void {
    this.x = v
    this.dirty = true
  }
  read(): number {
    if (this.dirty) {
      FakeElement.reflows++
      this.dirty = false
    }
    return this.x
  }
}

const COUNT = 500

function makeElements(): FakeElement[] {
  return Array.from({ length: COUNT }, () => new FakeElement())
}

describe("layout thrashing: 500 elements", () => {
  bench("naive interleaved read/write", () => {
    const els = makeElements()
    FakeElement.reflows = 0
    for (let i = 0; i < COUNT; i++) {
      const el = els[i]
      if (!el) continue
      el.write(i)
      const x = el.read()
      el.write(x + 1)
    }
  })

  bench("batched: all reads then all writes (synchronous)", () => {
    const els = makeElements()
    FakeElement.reflows = 0
    const b = createBatch()
    const values = new Array<number>(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const el = els[i]
      if (!el) continue
      el.write(i)
      const idx = i
      b.read(() => {
        values[idx] = el.read()
        return null
      })
      b.write(() => {
        el.write((values[idx] ?? 0) + 1)
      })
    }
    b.flush()
  })

  bench("batched via frame scheduler (flushSync)", () => {
    const els = makeElements()
    FakeElement.reflows = 0
    const s = createFrameScheduler({
      raf: {
        request: () => 0,
        cancel: () => {},
      },
    })
    const values = new Array<number>(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const el = els[i]
      if (!el) continue
      el.write(i)
      const idx = i
      s.schedule("read", () => {
        values[idx] = el.read()
      })
      s.schedule("update", () => {
        el.write((values[idx] ?? 0) + 1)
      })
    }
    s.flushSync(0)
  })
})
