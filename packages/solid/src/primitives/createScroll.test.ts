import { tween } from "@kinem/core"
import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createScroll } from "./createScroll"

describe("createScroll (solid)", () => {
  it("starts a scroll handle once an element is bound", () => {
    createRoot((dispose) => {
      const s = createScroll<HTMLDivElement>(tween({ opacity: [0, 1] }, { duration: 100 }))
      const el = document.createElement("div")
      s.ref(el)
      expect(s.handle).not.toBeNull()
      dispose()
    })
  })

  it("cancel() detaches the handle without disposing", () => {
    createRoot((dispose) => {
      const s = createScroll<HTMLDivElement>(tween({ opacity: [0, 1] }, { duration: 100 }))
      const el = document.createElement("div")
      s.ref(el)
      s.cancel()
      expect(s.handle).toBeNull()
      dispose()
    })
  })

  it("cancels the active handle on dispose", () => {
    let s!: ReturnType<typeof createScroll<HTMLDivElement>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      s = createScroll<HTMLDivElement>(tween({ opacity: [0, 1] }, { duration: 100 }))
      const el = document.createElement("div")
      s.ref(el)
    })
    dispose()
    expect(s.handle).toBeNull()
  })
})
