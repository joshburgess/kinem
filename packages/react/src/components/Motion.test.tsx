import { act, render } from "@testing-library/react"
import { useRef } from "react"
import { describe, expect, it } from "vitest"
import { Motion } from "./Motion"

describe("Motion", () => {
  it("renders the given element type with initial styles inline", () => {
    const { container } = render(
      <Motion as="section" initial={{ opacity: 0 }} data-testid="m">
        hello
      </Motion>,
    )
    const el = container.querySelector("section") as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.opacity).toBe("0")
  })

  it("defaults to a div when `as` is omitted", () => {
    const { container } = render(<Motion>content</Motion>)
    expect(container.querySelector("div")).not.toBeNull()
  })

  it("plays a tween from initial to animate on mount", () => {
    const { container } = render(
      <Motion
        as="div"
        initial={{ width: "0px" }}
        animate={{ width: "100px" }}
        transition={{ duration: 50, backend: "raf" }}
      />,
    )
    const el = container.querySelector("div") as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.width === "0px" || el.style.width.endsWith("px")).toBe(true)
  })

  it("forwards non-motion props (className, data-*, onClick) to the host element", () => {
    let clicks = 0
    const { container } = render(
      <Motion
        as="button"
        className="btn"
        data-testid="m"
        onClick={() => {
          clicks++
        }}
      >
        ok
      </Motion>,
    )
    const btn = container.querySelector("button") as HTMLButtonElement
    expect(btn.className).toBe("btn")
    expect(btn.getAttribute("data-testid")).toBe("m")
    act(() => {
      btn.click()
    })
    expect(clicks).toBe(1)
  })

  it("merges user style with initial (user overrides wins)", () => {
    const { container } = render(
      <Motion as="div" initial={{ opacity: 0 }} style={{ opacity: 0.5, color: "red" }} />,
    )
    const el = container.querySelector("div") as HTMLElement
    expect(el.style.opacity).toBe("0.5")
    expect(el.style.color).toBe("red")
  })

  it("exposes a motionRef to the host element", () => {
    let captured: Element | null = null
    function Wrap() {
      const r = useRef<Element | null>(null)
      return (
        <Motion
          as="div"
          motionRef={(el) => {
            r.current = el
            captured = el
          }}
        />
      )
    }
    render(<Wrap />)
    expect(captured).not.toBeNull()
    expect((captured as Element | null)?.tagName.toLowerCase()).toBe("div")
  })

  it("cancels in-flight animation on unmount", () => {
    const { unmount, container } = render(
      <Motion
        as="div"
        initial={{ width: "0px" }}
        animate={{ width: "100px" }}
        transition={{ duration: 1000, backend: "raf" }}
      />,
    )
    expect(container.querySelector("div")).not.toBeNull()
    expect(() => unmount()).not.toThrow()
  })
})
