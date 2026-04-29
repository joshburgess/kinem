import { tween } from "@kinem/core"
import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createGesture } from "./createGesture"

const enterAnim = () => tween({ opacity: [0, 1] }, { duration: 50 })

describe("createGesture (solid)", () => {
  it("attaches a drag handle when drag opts are provided", () => {
    createRoot((dispose) => {
      const g = createGesture<HTMLDivElement>({ drag: { axis: "x" } })
      const el = document.createElement("div")
      g.ref(el)
      expect(g.drag).not.toBeNull()
      expect(g.hover).toBeNull()
      dispose()
    })
  })

  it("attaches a hover handle when hover opts are provided", () => {
    createRoot((dispose) => {
      const g = createGesture<HTMLDivElement>({ hover: { enter: enterAnim() } })
      const el = document.createElement("div")
      g.ref(el)
      expect(g.hover).not.toBeNull()
      expect(g.drag).toBeNull()
      dispose()
    })
  })

  it("cancels every gesture on dispose", () => {
    let captured!: ReturnType<typeof createGesture<HTMLDivElement>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      captured = createGesture<HTMLDivElement>({ drag: {}, hover: { enter: enterAnim() } })
      const el = document.createElement("div")
      captured.ref(el)
      expect(captured.drag).not.toBeNull()
      expect(captured.hover).not.toBeNull()
    })
    dispose()
    expect(captured.drag).toBeNull()
    expect(captured.hover).toBeNull()
  })

  it("cancel() detaches without disposing the owner", () => {
    createRoot((dispose) => {
      const g = createGesture<HTMLDivElement>({ drag: {}, hover: { enter: enterAnim() } })
      const el = document.createElement("div")
      g.ref(el)
      g.cancel()
      expect(g.drag).toBeNull()
      expect(g.hover).toBeNull()
      dispose()
    })
  })
})
