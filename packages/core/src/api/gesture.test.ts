import { describe, expect, it } from "vitest"
import type { PointerBindTarget } from "../gesture/pointer"
import type { StrategyTarget } from "../render/strategy"
import { gesture } from "./gesture"
import { tween } from "./tween"

type Combined = StrategyTarget &
  PointerBindTarget & {
    listeners: Map<string, Set<(ev: unknown) => void>>
    styles: Map<string, string>
    emit(type: string): void
  }

function makeEl(): Combined {
  const listeners = new Map<string, Set<(ev: unknown) => void>>()
  const styles = new Map<string, string>()
  return {
    listeners,
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
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() {
      return false
    },
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

describe("gesture.hover", () => {
  it("uses the first animated element as pointer target by default", () => {
    const el = makeEl()
    const handle = gesture.hover([el], {
      enter: tween({ width: ["0px", "100px"] }, { duration: 100 }),
      backend: "raf",
    })

    expect(el.listeners.get("pointerenter")?.size ?? 0).toBe(1)
    el.emit("pointerenter")
    expect(handle.isHovering).toBe(true)

    handle.cancel()
    expect(el.listeners.get("pointerenter")?.size ?? 0).toBe(0)
  })

  it("honors explicit target opt", () => {
    const animated = makeEl()
    const controlEl = makeEl()
    gesture.hover([animated], {
      target: controlEl,
      enter: tween({ width: ["0px", "100px"] }, { duration: 100 }),
      backend: "raf",
    })
    expect(animated.listeners.get("pointerenter")?.size ?? 0).toBe(0)
    expect(controlEl.listeners.get("pointerenter")?.size ?? 0).toBe(1)
  })
})

describe("gesture.drag", () => {
  it("binds pointer listeners on the animated element by default", () => {
    const el = makeEl()
    const handle = gesture.drag([el])
    expect(handle.phase).toBe("idle")
    expect(el.styles.get("touch-action")).toBe("none")
    handle.cancel()
  })

  it("honors axis and explicit pointer target", () => {
    const animated = makeEl()
    const control = makeEl()
    const handle = gesture.drag([animated], { target: control, axis: "x" })
    expect(control.styles.get("touch-action")).toBe("pan-y")
    expect(animated.styles.get("touch-action")).toBeUndefined()
    handle.cancel()
  })

  it("throws when neither animated targets nor explicit target are provided", () => {
    expect(() => gesture.drag([])).toThrow(/no target element resolved/)
  })

  it("accepts a resolve override without throwing", () => {
    const el = makeEl()
    const handle = gesture.drag([el], {
      resolve: () => [el] as readonly StrategyTarget[],
    })
    expect(typeof handle.cancel).toBe("function")
    handle.cancel()
  })
})

describe("gesture.tap / press / pan / pinch", () => {
  it("tap binds a pointer target", () => {
    const el = makeEl()
    const handle = gesture.tap([el])
    expect(typeof handle.cancel).toBe("function")
    handle.cancel()
  })

  it("press binds a pointer target", () => {
    const el = makeEl()
    const handle = gesture.press([el])
    expect(typeof handle.cancel).toBe("function")
    handle.cancel()
  })

  it("pan binds a pointer target", () => {
    const el = makeEl()
    const handle = gesture.pan([el])
    expect(typeof handle.cancel).toBe("function")
    handle.cancel()
  })

  it("pinch binds a pointer target", () => {
    const el = makeEl()
    const handle = gesture.pinch([el])
    expect(typeof handle.cancel).toBe("function")
    handle.cancel()
  })

  it("tap honors explicit target opt", () => {
    const animated = makeEl()
    const control = makeEl()
    const handle = gesture.tap([animated], { target: control })
    expect(typeof handle.cancel).toBe("function")
    handle.cancel()
  })
})
