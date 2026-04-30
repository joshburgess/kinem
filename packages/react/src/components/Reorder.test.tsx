import { act, render } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Reorder } from "./Reorder"

interface RectMock {
  top: number
  left: number
  height: number
  width: number
}

function mockRects(rects: Map<HTMLElement, RectMock>): void {
  for (const [el, r] of rects) {
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
}

describe("Reorder", () => {
  it("renders the configured `as` element with children", () => {
    const noop = (): void => {}
    const { container } = render(
      <Reorder.Group as="ul" axis="y" values={["a", "b"]} onReorder={noop}>
        <Reorder.Item value="a" as="li">
          A
        </Reorder.Item>
        <Reorder.Item value="b" as="li">
          B
        </Reorder.Item>
      </Reorder.Group>,
    )
    expect(container.querySelector("ul")).not.toBeNull()
    expect(container.querySelectorAll("li")).toHaveLength(2)
  })

  it("throws when an Item is rendered outside a Group", () => {
    expect(() => render(<Reorder.Item value="orphan">x</Reorder.Item>)).toThrow(
      /Reorder.Item must be rendered inside a Reorder.Group/,
    )
  })

  it("applies a touch-action that allows the cross-axis pan", () => {
    const noop = (): void => {}
    const { container } = render(
      <Reorder.Group axis="y" values={["a"]} onReorder={noop}>
        <Reorder.Item value="a">A</Reorder.Item>
      </Reorder.Group>,
    )
    const item = container.querySelector("li") as HTMLElement
    expect(item.style.touchAction).toBe("pan-x")
  })

  it("commits a new order when the dragged item passes a sibling's center", () => {
    let received: string[] | null = null
    function Harness() {
      const [items, setItems] = useState<string[]>(["a", "b", "c"])
      return (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(next) => {
            received = next
            setItems(next)
          }}
        >
          {items.map((v) => (
            <Reorder.Item key={v} value={v} data-testid={`item-${v}`}>
              {v}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )
    }
    const { container } = render(<Harness />)
    const lis = Array.from(container.querySelectorAll("li")) as HTMLElement[]
    expect(lis).toHaveLength(3)
    const rectMap = new Map<HTMLElement, RectMock>()
    rectMap.set(lis[0]!, { top: 0, left: 0, height: 50, width: 200 })
    rectMap.set(lis[1]!, { top: 50, left: 0, height: 50, width: 200 })
    rectMap.set(lis[2]!, { top: 100, left: 0, height: 50, width: 200 })
    mockRects(rectMap)

    const a = lis[0]!
    act(() => {
      a.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 1,
          clientY: 25,
          clientX: 0,
          bubbles: true,
          button: 0,
        }),
      )
    })
    act(() => {
      a.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientY: 100,
          clientX: 0,
          bubbles: true,
        }),
      )
    })
    act(() => {
      a.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: 1,
          clientY: 100,
          clientX: 0,
          bubbles: true,
        }),
      )
    })
    expect(received).not.toBeNull()
    expect(received![0]).toBe("b")
  })

  it("does not call onReorder when the drag finishes in the original slot", () => {
    let calls = 0
    function Harness() {
      const [items] = useState<string[]>(["a", "b"])
      return (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={() => {
            calls++
          }}
        >
          {items.map((v) => (
            <Reorder.Item key={v} value={v}>
              {v}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )
    }
    const { container } = render(<Harness />)
    const lis = Array.from(container.querySelectorAll("li")) as HTMLElement[]
    const rectMap = new Map<HTMLElement, RectMock>()
    rectMap.set(lis[0]!, { top: 0, left: 0, height: 50, width: 200 })
    rectMap.set(lis[1]!, { top: 50, left: 0, height: 50, width: 200 })
    mockRects(rectMap)

    const a = lis[0]!
    act(() => {
      a.dispatchEvent(
        new PointerEvent("pointerdown", { pointerId: 1, clientY: 25, bubbles: true, button: 0 }),
      )
    })
    act(() => {
      a.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientY: 30, bubbles: true }))
    })
    act(() => {
      a.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientY: 30, bubbles: true }))
    })
    expect(calls).toBe(0)
  })
})
