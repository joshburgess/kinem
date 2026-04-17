import { describe, expect, it, vi } from "vitest"
import {
  type PointerBindTarget,
  type PointerEventShim,
  createDomPointerSource,
  createVelocityTracker,
} from "./pointer"

function makeTarget(): PointerBindTarget & {
  listeners: Map<string, Set<(ev: PointerEventShim) => void>>
  captured: Set<number>
  emit(type: string, ev: PointerEventShim): void
} {
  const listeners = new Map<string, Set<(ev: PointerEventShim) => void>>()
  const captured = new Set<number>()
  return {
    listeners,
    captured,
    setPointerCapture(id: number) {
      captured.add(id)
    },
    releasePointerCapture(id: number) {
      captured.delete(id)
    },
    hasPointerCapture(id: number) {
      return captured.has(id)
    },
    addEventListener(type, cb) {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(cb)
    },
    removeEventListener(type, cb) {
      listeners.get(type)?.delete(cb)
    },
    emit(type, ev) {
      const set = listeners.get(type)
      if (!set) return
      for (const cb of set) cb(ev)
    },
  }
}

function ev(
  over: Partial<PointerEventShim> & { x?: number; y?: number; t?: number; id?: number },
): PointerEventShim {
  return {
    pointerId: over.id ?? 1,
    pointerType: "mouse",
    clientX: over.x ?? 0,
    clientY: over.y ?? 0,
    timeStamp: over.t ?? 0,
    ...over,
  }
}

describe("createDomPointerSource", () => {
  it("captures the pointer on start and releases on end", () => {
    const t = makeTarget()
    const h = { onStart: vi.fn(), onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() }
    const unsub = createDomPointerSource().bind(t, h)

    t.emit("pointerdown", ev({ id: 7, x: 10, y: 20 }))
    expect(t.captured.has(7)).toBe(true)
    expect(h.onStart).toHaveBeenCalledOnce()

    t.emit("pointermove", ev({ id: 7, x: 30, y: 40 }))
    expect(h.onMove).toHaveBeenCalledOnce()

    t.emit("pointerup", ev({ id: 7, x: 30, y: 40 }))
    expect(t.captured.has(7)).toBe(false)
    expect(h.onEnd).toHaveBeenCalledOnce()

    unsub()
    t.emit("pointermove", ev({ id: 7 }))
    expect(h.onMove).toHaveBeenCalledOnce()
  })

  it("releases capture on cancel", () => {
    const t = makeTarget()
    const h = { onCancel: vi.fn() }
    createDomPointerSource().bind(t, h)
    t.emit("pointerdown", ev({ id: 1 }))
    t.emit("pointercancel", ev({ id: 1 }))
    expect(t.captured.has(1)).toBe(false)
    expect(h.onCancel).toHaveBeenCalledOnce()
  })
})

describe("createVelocityTracker", () => {
  it("returns zero velocity with fewer than two samples", () => {
    const v = createVelocityTracker()
    expect(v.velocity()).toEqual({ x: 0, y: 0 })
    v.record({ x: 0, y: 0, time: 0 })
    expect(v.velocity()).toEqual({ x: 0, y: 0 })
  })

  it("computes px/ms velocity across recent samples", () => {
    const v = createVelocityTracker({ windowMs: 100 })
    v.record({ x: 0, y: 0, time: 0 })
    v.record({ x: 50, y: 25, time: 50 })
    expect(v.velocity()).toEqual({ x: 1, y: 0.5 })
  })

  it("ignores samples outside the window", () => {
    const v = createVelocityTracker({ windowMs: 50 })
    v.record({ x: 0, y: 0, time: 0 })
    v.record({ x: 20, y: 0, time: 40 }) // 40ms ago, inside window
    v.record({ x: 30, y: 0, time: 80 }) // latest
    // window is [30, 80], so samples at time >= 30 are in window: only (20,0,40) and (30,0,80)
    // oldest-in-window: (20, 0, 40). dt = 40; dx = 10 → vx = 0.25
    expect(v.velocity()).toEqual({ x: 0.25, y: 0 })
  })

  it("honors maxSamples by dropping oldest", () => {
    const v = createVelocityTracker({ maxSamples: 3, windowMs: 1000 })
    v.record({ x: 0, y: 0, time: 0 })
    v.record({ x: 10, y: 0, time: 10 })
    v.record({ x: 20, y: 0, time: 20 })
    v.record({ x: 30, y: 0, time: 30 })
    // buffer now: [10..20], [20..30]. Velocity = (30 - 10) / (30 - 10) = 1
    expect(v.velocity()).toEqual({ x: 1, y: 0 })
  })

  it("reset clears the buffer", () => {
    const v = createVelocityTracker()
    v.record({ x: 0, y: 0, time: 0 })
    v.record({ x: 100, y: 0, time: 100 })
    v.reset()
    expect(v.velocity()).toEqual({ x: 0, y: 0 })
  })
})
