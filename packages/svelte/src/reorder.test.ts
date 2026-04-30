// @vitest-environment happy-dom

import { describe, expect, it } from "vitest"
import { reorderGroup, reorderItem } from "./reorder"

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

const buildList = (
  values: string[],
  axis: "x" | "y",
  onReorder: (next: string[]) => void,
): {
  ul: HTMLElement
  lis: HTMLElement[]
  groupAction: ReturnType<typeof reorderGroup<string>>
  itemActions: Array<ReturnType<typeof reorderItem<string>>>
  cleanup: () => void
} => {
  const ul = document.createElement("ul")
  document.body.appendChild(ul)
  const groupAction = reorderGroup<string>(ul, { values, onReorder, axis })
  const lis: HTMLElement[] = []
  const itemActions: Array<ReturnType<typeof reorderItem<string>>> = []
  for (let i = 0; i < values.length; i++) {
    const li = document.createElement("li")
    ul.appendChild(li)
    if (axis === "y") {
      mockRect(li, { top: i * 50, left: 0, width: 200, height: 50 })
    } else {
      mockRect(li, { top: 0, left: i * 50, width: 50, height: 200 })
    }
    const ia = reorderItem<string>(li, { value: values[i]! })
    lis.push(li)
    itemActions.push(ia)
  }
  return {
    ul,
    lis,
    groupAction,
    itemActions,
    cleanup(): void {
      for (const ia of itemActions) ia.destroy()
      groupAction.destroy()
      ul.remove()
    },
  }
}

describe("reorderGroup / reorderItem (svelte actions)", () => {
  it("commits a new order when the dragged item passes a sibling's center", () => {
    let received: string[] | null = null
    let values: string[] = ["a", "b", "c"]
    const ctx = buildList(values, "y", (next) => {
      received = next
      values = next
    })
    ctx.lis[0]!.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        clientY: 25,
        clientX: 0,
        button: 0,
        bubbles: true,
      }),
    )
    ctx.lis[0]!.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientY: 100,
        clientX: 0,
        bubbles: true,
      }),
    )
    ctx.lis[0]!.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 1,
        clientY: 100,
        clientX: 0,
        bubbles: true,
      }),
    )
    expect(received).not.toBeNull()
    expect(received![0]).toBe("b")
    ctx.cleanup()
  })

  it("does not commit when the drag finishes in the original slot", () => {
    let calls = 0
    const ctx = buildList(["a", "b"], "y", () => {
      calls++
    })
    ctx.lis[0]!.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 1,
        clientY: 25,
        button: 0,
        bubbles: true,
      }),
    )
    ctx.lis[0]!.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientY: 30, bubbles: true }),
    )
    ctx.lis[0]!.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, clientY: 30, bubbles: true }),
    )
    expect(calls).toBe(0)
    ctx.cleanup()
  })

  it("throws when reorderItem is applied without a parent group", () => {
    const orphan = document.createElement("li")
    document.body.appendChild(orphan)
    expect(() => reorderItem<string>(orphan, { value: "x" })).toThrow(
      /reorderItem must be applied inside an element using reorderGroup/,
    )
    orphan.remove()
  })

  it("applies a touch-action that allows the cross-axis pan", () => {
    const ctx = buildList(["a"], "y", () => {})
    expect(ctx.lis[0]!.style.touchAction).toBe("pan-x")
    ctx.cleanup()
  })

  it("destroy() unregisters the group so children mounted later cannot find it", () => {
    const ctx = buildList(["a"], "y", () => {})
    ctx.cleanup()
    const orphan = document.createElement("li")
    ctx.ul.appendChild(orphan)
    expect(() => reorderItem<string>(orphan, { value: "a" })).toThrow(
      /reorderItem must be applied inside an element using reorderGroup/,
    )
    orphan.remove()
  })
})
