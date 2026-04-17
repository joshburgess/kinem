import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StrategyTarget } from "../render/strategy"
import type { Clock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import { playDrag } from "./drag"
import type { PointerBindTarget, PointerEventShim, PointerHandlers, PointerSource } from "./pointer"

function makeTarget(): StrategyTarget & {
  styles: Map<string, string>
} {
  const styles = new Map<string, string>()
  return {
    styles,
    style: {
      setProperty(name, value) {
        styles.set(name, value)
      },
    },
    setAttribute() {},
    animate() {
      throw new Error("WAAPI not used")
    },
  }
}

function makeBindTarget(): PointerBindTarget & {
  style: { setProperty(name: string, value: string): void }
  props: Map<string, string>
} {
  const props = new Map<string, string>()
  return {
    props,
    style: {
      setProperty(name, value) {
        props.set(name, value)
      },
    },
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

function makeEnv() {
  let nextId = 1
  const pending = new Map<number, (t: number) => void>()
  const raf: RafLike = {
    request(cb) {
      const id = nextId++
      pending.set(id, cb)
      return id
    },
    cancel(id) {
      pending.delete(id)
    },
  }
  let clockTime = 0
  const clock: Clock = {
    now: () => clockTime,
    pause() {},
    resume() {},
    paused: false,
    setSpeed() {},
    speed: 1,
    reset() {
      clockTime = 0
    },
  }
  const scheduler = createFrameScheduler({ raf, now: () => clockTime })
  return {
    scheduler,
    clock,
    advance(ms: number) {
      clockTime += ms
    },
    tick() {
      const entries = [...pending]
      pending.clear()
      for (const [, cb] of entries) cb(clockTime)
    },
  }
}

describe("playDrag", () => {
  let env: ReturnType<typeof makeEnv>
  beforeEach(() => {
    env = makeEnv()
  })

  it("updates offset while dragging and writes to targets", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { pointerId: 1, clientX: 100, clientY: 50, timeStamp: 0 })
    emit("move", { pointerId: 1, clientX: 130, clientY: 70, timeStamp: 16 })

    expect(handle.offset).toEqual({ x: 30, y: 20 })
    expect(el.styles.get("transform")).toBe("translateX(30px) translateY(20px)")
    expect(handle.phase).toBe("dragging")
  })

  it("locks to the configured axis", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      axis: "x",
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 50, clientY: 40 })

    expect(handle.offset).toEqual({ x: 50, y: 0 })
  })

  it("applies touch-action to the target based on axis", () => {
    const target = makeBindTarget()
    const { source } = makeSource()
    playDrag([makeTarget()], { target, source, axis: "x" })
    expect(target.props.get("touch-action")).toBe("pan-y")

    const target2 = makeBindTarget()
    playDrag([makeTarget()], { target: target2, source, axis: "y" })
    expect(target2.props.get("touch-action")).toBe("pan-x")

    const target3 = makeBindTarget()
    playDrag([makeTarget()], { target: target3, source })
    expect(target3.props.get("touch-action")).toBe("none")
  })

  it("clamps offset to bounds", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      bounds: { left: -10, right: 10, top: -5, bottom: 5 },
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 100, clientY: 100 })
    expect(handle.offset).toEqual({ x: 10, y: 5 })

    emit("move", { clientX: -100, clientY: -100 })
    expect(handle.offset).toEqual({ x: -10, y: -5 })
  })

  it("releases to origin and animates toward it", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      release: { duration: 100 },
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0, timeStamp: 0 })
    emit("move", { clientX: 100, clientY: 0, timeStamp: 16 })
    expect(handle.offset).toEqual({ x: 100, y: 0 })

    emit("end", { clientX: 100, clientY: 0, timeStamp: 20 })
    expect(handle.phase).toBe("releasing")

    env.advance(50)
    env.tick()
    expect(handle.offset.x).toBeGreaterThan(0)
    expect(handle.offset.x).toBeLessThan(100)

    env.advance(50)
    env.tick()
    expect(handle.offset).toEqual({ x: 0, y: 0 })
    expect(handle.phase).toBe("idle")
  })

  it("snaps to nearest point within threshold", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      snap: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        threshold: 40,
      },
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0, timeStamp: 0 })
    emit("move", { clientX: 75, clientY: 0, timeStamp: 16 })
    emit("end", { clientX: 75, clientY: 0, timeStamp: 32 })

    env.advance(400)
    env.tick()
    expect(handle.offset).toEqual({ x: 100, y: 0 })
  })

  it("stays in place if no snap matches and no release configured", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 25, clientY: 35 })
    emit("end", { clientX: 25, clientY: 35 })

    expect(handle.phase).toBe("idle")
    expect(handle.offset).toEqual({ x: 25, y: 35 })
  })

  it("re-grab during release cancels release and continues drag", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      release: { duration: 100 },
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0, timeStamp: 0 })
    emit("move", { clientX: 100, clientY: 0, timeStamp: 16 })
    emit("end", { clientX: 100, clientY: 0, timeStamp: 20 })
    expect(handle.phase).toBe("releasing")

    env.advance(50)
    env.tick()
    const midX = handle.offset.x
    expect(midX).toBeGreaterThan(0)
    expect(midX).toBeLessThan(100)

    emit("start", { clientX: 200, clientY: 0, timeStamp: 80 })
    expect(handle.phase).toBe("dragging")

    emit("move", { clientX: 210, clientY: 0, timeStamp: 96 })
    expect(handle.offset.x).toBeCloseTo(midX + 10, 5)
  })

  it("fires onStart/onMove/onEnd with offset and velocity", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const onStart = vi.fn()
    const onMove = vi.fn()
    const onEnd = vi.fn()

    playDrag([el], {
      target,
      source,
      onStart,
      onMove,
      onEnd,
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0, timeStamp: 0 })
    emit("move", { clientX: 50, clientY: 0, timeStamp: 50 })
    emit("end", { clientX: 50, clientY: 0, timeStamp: 60 })

    expect(onStart).toHaveBeenCalledOnce()
    expect(onMove).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()

    const endArg = onEnd.mock.calls[0]?.[0]
    expect(endArg.offset).toEqual({ x: 50, y: 0 })
    expect(endArg.velocity.x).toBeGreaterThan(0)
  })

  it("cancel unsubscribes and halts release", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      release: { duration: 100 },
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 100, clientY: 0 })
    emit("end", { clientX: 100, clientY: 0 })

    handle.cancel()
    expect(handle.phase).toBe("cancelled")

    const before = handle.offset
    env.advance(200)
    env.tick()
    expect(handle.offset).toEqual(before)
  })

  it("ignores pointer events from a different pointer id", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const handle = playDrag([el], {
      target,
      source,
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { pointerId: 1, clientX: 0, clientY: 0 })
    emit("move", { pointerId: 2, clientX: 999, clientY: 999 })
    expect(handle.offset).toEqual({ x: 0, y: 0 })

    emit("move", { pointerId: 1, clientX: 10, clientY: 5 })
    expect(handle.offset).toEqual({ x: 10, y: 5 })
  })

  it("onCancel cleanly aborts an in-progress drag", () => {
    const target = makeBindTarget()
    const el = makeTarget()
    const { source, emit } = makeSource()

    const onEnd = vi.fn()
    const handle = playDrag([el], {
      target,
      source,
      onEnd,
      scheduler: env.scheduler,
      clock: env.clock,
    })

    emit("start", { clientX: 0, clientY: 0 })
    emit("move", { clientX: 40, clientY: 0 })
    emit("cancel", { clientX: 40, clientY: 0 })

    expect(onEnd).toHaveBeenCalledOnce()
    expect(handle.phase).toBe("idle")
    expect(handle.offset).toEqual({ x: 40, y: 0 })
  })
})
