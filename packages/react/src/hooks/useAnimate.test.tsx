import { act, render } from "@testing-library/react"
import { useEffect, useRef } from "react"
import { describe, expect, it } from "vitest"
import { useAnimate } from "./useAnimate"

describe("useAnimate", () => {
  it("returns a stable [scope, animate] tuple", () => {
    const captured: Array<{ scope: unknown; animate: unknown }> = []
    function Probe() {
      const [scope, animate] = useAnimate()
      captured.push({ scope, animate })
      return <div ref={scope} />
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(captured[0]!.scope).toBe(captured[1]!.scope)
    expect(captured[0]!.animate).toBe(captured[1]!.animate)
  })

  it("resolves a CSS selector against the scope and animates matches", async () => {
    let animateRef: ReturnType<typeof useAnimate>[1] | null = null
    function Probe() {
      const [scope, animate] = useAnimate()
      animateRef = animate
      return (
        <ul ref={scope}>
          <li className="row" />
          <li className="row" />
        </ul>
      )
    }
    render(<Probe />)
    let controls: ReturnType<typeof animateRef> | null = null
    act(() => {
      controls = animateRef!("li.row", { opacity: [0, 1] }, { duration: 1 })
    })
    expect(controls).not.toBeNull()
    await controls!.finished
  })

  it("accepts a direct element as target", async () => {
    let animateRef: ReturnType<typeof useAnimate>[1] | null = null
    let elRef: HTMLDivElement | null = null
    function Probe() {
      const [scope, animate] = useAnimate()
      animateRef = animate
      const ref = useRef<HTMLDivElement | null>(null)
      useEffect(() => {
        elRef = ref.current
      })
      return (
        <div ref={scope}>
          <div ref={ref} />
        </div>
      )
    }
    render(<Probe />)
    expect(elRef).not.toBeNull()
    let controls: ReturnType<typeof animateRef> | null = null
    act(() => {
      controls = animateRef!(elRef!, { opacity: [0, 1] }, { duration: 1 })
    })
    await controls!.finished
  })

  it("returns settled controls when no targets resolve", async () => {
    let animateRef: ReturnType<typeof useAnimate>[1] | null = null
    function Probe() {
      const [scope, animate] = useAnimate()
      animateRef = animate
      return <div ref={scope} />
    }
    render(<Probe />)
    const controls = animateRef!(".no-such-thing", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
    expect(controls.duration).toBeGreaterThanOrEqual(0)
  })
})
