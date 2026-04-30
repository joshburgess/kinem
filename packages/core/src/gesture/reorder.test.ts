// @vitest-environment happy-dom

import { describe, expect, it } from "vitest"
import { createReorderController } from "./reorder"

interface RectMock {
  top: number
  left: number
  width: number
  height: number
}

const mockRect = (el: HTMLElement, r: RectMock): void => {
  el.getBoundingClientRect = (): DOMRect =>
    ({
      top: r.top,
      bottom: r.top + r.height,
      left: r.left,
      right: r.left + r.width,
      width: r.width,
      height: r.height,
      x: r.left,
      y: r.top,
      toJSON: (): RectMock => r,
    }) as DOMRect
}

const makeItems = (count: number, axis: "x" | "y"): HTMLElement[] => {
  const els: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div")
    if (axis === "y") {
      mockRect(el, { top: i * 50, left: 0, width: 200, height: 50 })
    } else {
      mockRect(el, { top: 0, left: i * 50, width: 50, height: 200 })
    }
    els.push(el)
  }
  return els
}

describe("createReorderController", () => {
  it("commits a new order when the dragged item passes a sibling's center", () => {
    let received: string[] | null = null
    let values: string[] = ["a", "b", "c"]
    const ctrl = createReorderController<string>({
      axis: "y",
      getValues: () => values,
      commit: (next) => {
        received = next
        values = next
      },
    })
    const els = makeItems(3, "y")
    ctrl.registerItem("a", els[0]!)
    ctrl.registerItem("b", els[1]!)
    ctrl.registerItem("c", els[2]!)
    const session = ctrl.startDrag("a", 1, 25)!
    expect(session).not.toBeNull()
    session.move(100)
    session.end()
    expect(received).not.toBeNull()
    expect(received![0]).toBe("b")
  })

  it("does not commit when end occurs in the original slot", () => {
    let calls = 0
    const ctrl = createReorderController<string>({
      axis: "y",
      getValues: () => ["a", "b"],
      commit: () => {
        calls++
      },
    })
    const els = makeItems(2, "y")
    ctrl.registerItem("a", els[0]!)
    ctrl.registerItem("b", els[1]!)
    const session = ctrl.startDrag("a", 1, 25)!
    session.move(30)
    session.end()
    expect(calls).toBe(0)
  })

  it("works on the x axis", () => {
    let received: string[] | null = null
    let values: string[] = ["a", "b", "c"]
    const ctrl = createReorderController<string>({
      axis: "x",
      getValues: () => values,
      commit: (next) => {
        received = next
        values = next
      },
    })
    const els = makeItems(3, "x")
    ctrl.registerItem("a", els[0]!)
    ctrl.registerItem("b", els[1]!)
    ctrl.registerItem("c", els[2]!)
    const session = ctrl.startDrag("a", 1, 25)!
    session.move(100)
    session.end()
    expect(received).not.toBeNull()
    expect(received![0]).toBe("b")
  })

  it("returns null when the dragged value is not registered", () => {
    const ctrl = createReorderController<string>({
      axis: "y",
      getValues: () => ["a"],
      commit: () => {},
    })
    expect(ctrl.startDrag("orphan", 1, 0)).toBeNull()
  })

  it("translates non-dragged siblings during the drag and clears on end", () => {
    let values: string[] = ["a", "b", "c"]
    const ctrl = createReorderController<string>({
      axis: "y",
      getValues: () => values,
      commit: (next) => {
        values = next
      },
    })
    const els = makeItems(3, "y")
    ctrl.registerItem("a", els[0]!)
    ctrl.registerItem("b", els[1]!)
    ctrl.registerItem("c", els[2]!)
    const session = ctrl.startDrag("a", 1, 25)!
    session.move(100)
    expect(els[1]!.style.transform).not.toBe("")
    session.end()
    expect(els[1]!.style.transform).toBe("")
    expect(els[2]!.style.transform).toBe("")
  })

  it("cancel() clears transforms and skips commit", () => {
    let calls = 0
    const ctrl = createReorderController<string>({
      axis: "y",
      getValues: () => ["a", "b"],
      commit: () => {
        calls++
      },
    })
    const els = makeItems(2, "y")
    ctrl.registerItem("a", els[0]!)
    ctrl.registerItem("b", els[1]!)
    const session = ctrl.startDrag("a", 1, 25)!
    session.move(100)
    session.cancel()
    expect(calls).toBe(0)
    expect(els[0]!.style.transform).toBe("")
  })
})
