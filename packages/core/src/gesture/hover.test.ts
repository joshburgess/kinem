import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import type { StrategyTarget } from "../render/strategy"
import { playHover } from "./hover"
import type { PointerBindTarget } from "./pointer"

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
  listeners: Map<string, Set<(ev: unknown) => void>>
  emit(type: string): void
} {
  const listeners = new Map<string, Set<(ev: unknown) => void>>()
  return {
    listeners,
    addEventListener(type, cb) {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(cb as (ev: unknown) => void)
    },
    removeEventListener(type, cb) {
      listeners.get(type)?.delete(cb as (ev: unknown) => void)
    },
    emit(type) {
      const set = listeners.get(type)
      if (!set) return
      for (const cb of set) cb({})
    },
  }
}

describe("playHover", () => {
  it("plays enter on pointerenter and leave on pointerleave", () => {
    const bind = makeBindTarget()
    const el = makeTarget()

    const handle = playHover([el], {
      target: bind,
      enter: tween({ width: ["0px", "100px"] }, { duration: 100 }),
      leave: tween({ width: ["100px", "0px"] }, { duration: 100 }),
      backend: "raf",
    })

    expect(handle.isHovering).toBe(false)

    bind.emit("pointerenter")
    expect(handle.isHovering).toBe(true)
    expect(handle.state).toBe("active")

    bind.emit("pointerleave")
    expect(handle.isHovering).toBe(false)
  })

  it("reverses enter when leave is omitted", () => {
    const bind = makeBindTarget()
    const el = makeTarget()

    const handle = playHover([el], {
      target: bind,
      enter: tween({ width: ["0px", "100px"] }, { duration: 100 }),
      backend: "raf",
    })

    bind.emit("pointerenter")
    bind.emit("pointerleave")
    expect(handle.state).toBe("active")
    expect(handle.isHovering).toBe(false)
  })

  it("cancel removes listeners and halts the current animation", () => {
    const bind = makeBindTarget()
    const el = makeTarget()

    const handle = playHover([el], {
      target: bind,
      enter: tween({ width: ["0px", "100px"] }, { duration: 100 }),
      backend: "raf",
    })

    bind.emit("pointerenter")
    handle.cancel()
    expect(handle.state).toBe("cancelled")
    expect(bind.listeners.get("pointerenter")?.size ?? 0).toBe(0)
    expect(bind.listeners.get("pointerleave")?.size ?? 0).toBe(0)

    bind.emit("pointerenter")
    expect(handle.state).toBe("cancelled")
  })
})
