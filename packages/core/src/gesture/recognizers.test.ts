import { describe, expect, it, vi } from "vitest"
import { createClock } from "../scheduler/clock"
import type { PointerBindTarget, PointerEventShim, PointerHandlers, PointerSource } from "./pointer"
import { type Timer, playPan, playPinch, playPress, playTap } from "./recognizers"

function makeBindTarget(): PointerBindTarget {
  return {
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() {
      return false
    },
    addEventListener() {},
    removeEventListener() {},
  }
}

function makeSource() {
  let handlers: PointerHandlers = {}
  const source: PointerSource = {
    bind(_el, h) {
      handlers = h
      return () => {
        handlers = {}
      }
    },
  }
  function emit(kind: "start" | "move" | "end" | "cancel", ev: Partial<PointerEventShim>): void {
    const full: PointerEventShim = {
      pointerId: ev.pointerId ?? 1,
      pointerType: ev.pointerType ?? "mouse",
      clientX: ev.clientX ?? 0,
      clientY: ev.clientY ?? 0,
      timeStamp: ev.timeStamp ?? 0,
    }
    if (kind === "start") handlers.onStart?.(full)
    if (kind === "move") handlers.onMove?.(full)
    if (kind === "end") handlers.onEnd?.(full)
    if (kind === "cancel") handlers.onCancel?.(full)
  }
  return { source, emit }
}

function makeManualTimer(): Timer & { fire(): void; pending: number } {
  let cb: (() => void) | null = null
  return {
    pending: 0,
    set(fn) {
      cb = fn
      this.pending++
      return fn
    },
    clear() {
      if (cb) this.pending--
      cb = null
    },
    fire() {
      const c = cb
      cb = null
      if (c) this.pending--
      c?.()
    },
  }
}

describe("playTap", () => {
  it("fires onTap when pointer goes up within thresholds", () => {
    const { source, emit } = makeSource()
    const clock = createClock({ now: (() => 0) as unknown as () => number })
    let t = 0
    const localClock = { ...clock, now: () => t }
    const onTap = vi.fn()
    playTap({ target: makeBindTarget(), source, clock: localClock, onTap })

    emit("start", { clientX: 10, clientY: 10, timeStamp: 0 })
    t = 100
    emit("end", { clientX: 12, clientY: 11, timeStamp: 100 })
    expect(onTap).toHaveBeenCalledOnce()
    const [ev] = onTap.mock.calls[0] ?? []
    expect(ev.duration).toBe(100)
    expect(ev.point).toEqual({ x: 12, y: 11 })
  })

  it("does not fire when duration exceeds maxDuration", () => {
    const { source, emit } = makeSource()
    let t = 0
    const clock = { now: () => t } as ReturnType<typeof createClock>
    const onTap = vi.fn()
    playTap({
      target: makeBindTarget(),
      source,
      clock,
      maxDuration: 100,
      onTap,
    })
    emit("start", { clientX: 0, clientY: 0 })
    t = 500
    emit("end", { clientX: 0, clientY: 0 })
    expect(onTap).not.toHaveBeenCalled()
  })

  it("does not fire when movement exceeds maxMovement", () => {
    const { source, emit } = makeSource()
    let t = 0
    const clock = { now: () => t } as ReturnType<typeof createClock>
    const onTap = vi.fn()
    playTap({
      target: makeBindTarget(),
      source,
      clock,
      maxMovement: 5,
      onTap,
    })
    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 20, clientY: 0 })
    t = 50
    emit("end", { clientX: 20, clientY: 0 })
    expect(onTap).not.toHaveBeenCalled()
  })

  it("cancel detaches listeners", () => {
    const { source, emit } = makeSource()
    const onTap = vi.fn()
    const handle = playTap({ target: makeBindTarget(), source, onTap })
    handle.cancel()
    emit("start", {})
    emit("end", {})
    expect(onTap).not.toHaveBeenCalled()
    expect(handle.state).toBe("cancelled")
  })
})

describe("playPress", () => {
  it("fires onPress after minDuration elapses", () => {
    const { source, emit } = makeSource()
    const timer = makeManualTimer()
    const onPress = vi.fn()
    const handle = playPress({
      target: makeBindTarget(),
      source,
      timer,
      minDuration: 500,
      onPress,
    })
    emit("start", { clientX: 10, clientY: 10 })
    expect(handle.state).toBe("tracking")
    timer.fire()
    expect(onPress).toHaveBeenCalledOnce()
    expect(handle.state).toBe("active")
  })

  it("cancels if pointer moves past maxMovement", () => {
    const { source, emit } = makeSource()
    const timer = makeManualTimer()
    const onPress = vi.fn()
    const onCancel = vi.fn()
    playPress({
      target: makeBindTarget(),
      source,
      timer,
      minDuration: 500,
      maxMovement: 5,
      onPress,
      onCancel,
    })
    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 20, clientY: 0 })
    expect(onCancel).toHaveBeenCalledOnce()
    timer.fire()
    expect(onPress).not.toHaveBeenCalled()
  })

  it("cancels if pointer ends before duration", () => {
    const { source, emit } = makeSource()
    const timer = makeManualTimer()
    const onPress = vi.fn()
    const onCancel = vi.fn()
    playPress({
      target: makeBindTarget(),
      source,
      timer,
      onPress,
      onCancel,
    })
    emit("start", {})
    emit("end", {})
    expect(onCancel).toHaveBeenCalledOnce()
    timer.fire()
    expect(onPress).not.toHaveBeenCalled()
  })

  it("cancel clears the timer", () => {
    const { source, emit } = makeSource()
    const timer = makeManualTimer()
    const handle = playPress({
      target: makeBindTarget(),
      source,
      timer,
    })
    emit("start", {})
    expect(timer.pending).toBe(1)
    handle.cancel()
    expect(timer.pending).toBe(0)
    expect(handle.state).toBe("cancelled")
  })
})

describe("playPan", () => {
  it("emits onStart once movement crosses threshold, then onMove", () => {
    const { source, emit } = makeSource()
    const onStart = vi.fn()
    const onMove = vi.fn()
    const onEnd = vi.fn()
    const handle = playPan({
      target: makeBindTarget(),
      source,
      threshold: 10,
      onStart,
      onMove,
      onEnd,
    })

    emit("start", { clientX: 0, clientY: 0, timeStamp: 0 })
    emit("move", { clientX: 5, clientY: 0, timeStamp: 10 })
    expect(onStart).not.toHaveBeenCalled()
    emit("move", { clientX: 20, clientY: 0, timeStamp: 30 })
    expect(onStart).toHaveBeenCalledOnce()
    emit("move", { clientX: 25, clientY: 0, timeStamp: 40 })
    expect(onMove).toHaveBeenCalledOnce()
    emit("end", { clientX: 25, clientY: 0, timeStamp: 50 })
    expect(onEnd).toHaveBeenCalledOnce()
    expect(handle.offset).toEqual({ x: 25, y: 0 })
  })

  it("locks to the chosen axis", () => {
    const { source, emit } = makeSource()
    const onMove = vi.fn()
    playPan({
      target: makeBindTarget(),
      source,
      axis: "x",
      threshold: 0,
      onMove,
    })
    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 10, clientY: 30 })
    // first onMove is swallowed by the onStart branch when threshold=0
    emit("move", { clientX: 20, clientY: 40 })
    const [ev] = onMove.mock.calls[0] ?? []
    expect(ev.offset).toEqual({ x: 20, y: 0 })
  })

  it("does not emit onEnd if pan never crossed threshold", () => {
    const { source, emit } = makeSource()
    const onEnd = vi.fn()
    playPan({
      target: makeBindTarget(),
      source,
      threshold: 50,
      onEnd,
    })
    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 5, clientY: 0 })
    emit("end", { clientX: 5, clientY: 0 })
    expect(onEnd).not.toHaveBeenCalled()
  })
})

describe("playPinch", () => {
  it("reports scale when the distance between pointers changes", () => {
    const { source, emit } = makeSource()
    const onStart = vi.fn()
    const onChange = vi.fn()
    const onEnd = vi.fn()
    const handle = playPinch({
      target: makeBindTarget(),
      source,
      onStart,
      onChange,
      onEnd,
    })

    emit("start", { pointerId: 1, clientX: 0, clientY: 0 })
    expect(handle.state).toBe("tracking")
    emit("start", { pointerId: 2, clientX: 100, clientY: 0 })
    expect(handle.state).toBe("active")
    expect(onStart).toHaveBeenCalledOnce()

    emit("move", { pointerId: 2, clientX: 200, clientY: 0 })
    expect(onChange).toHaveBeenCalledOnce()
    expect(handle.scale).toBeCloseTo(2)

    emit("end", { pointerId: 2, clientX: 200, clientY: 0 })
    expect(onEnd).toHaveBeenCalledOnce()
    expect(handle.state).not.toBe("active")
  })

  it("reports rotation when pointers rotate around each other", () => {
    const { source, emit } = makeSource()
    const onChange = vi.fn()
    const handle = playPinch({ target: makeBindTarget(), source, onChange })

    emit("start", { pointerId: 1, clientX: 0, clientY: 0 })
    emit("start", { pointerId: 2, clientX: 100, clientY: 0 })
    // Rotate pointer 2 to (0, 100) relative to pointer 1 — 90° clockwise.
    emit("move", { pointerId: 2, clientX: 0, clientY: 100 })
    expect(onChange).toHaveBeenCalledOnce()
    expect(handle.rotation).toBeCloseTo(Math.PI / 2)
  })

  it("cancel detaches listeners", () => {
    const { source, emit } = makeSource()
    const onChange = vi.fn()
    const handle = playPinch({ target: makeBindTarget(), source, onChange })
    handle.cancel()
    emit("start", { pointerId: 1, clientX: 0, clientY: 0 })
    emit("start", { pointerId: 2, clientX: 100, clientY: 0 })
    emit("move", { pointerId: 2, clientX: 200, clientY: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })
})
