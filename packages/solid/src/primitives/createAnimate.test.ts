// @vitest-environment happy-dom

import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createAnimate } from "./createAnimate"

describe("createAnimate (solid)", () => {
  it("animates elements matching the selector inside scope", async () => {
    const root = document.createElement("ul")
    const a = document.createElement("li")
    a.className = "row"
    const b = document.createElement("li")
    b.className = "row"
    root.appendChild(a)
    root.appendChild(b)
    document.body.appendChild(root)
    let dispose_: (() => void) | null = null
    let api: ReturnType<typeof createAnimate> | null = null
    createRoot((dispose) => {
      dispose_ = dispose
      api = createAnimate()
      api.scope(root)
    })
    const controls = api!.animate("li.row", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
    dispose_!()
    document.body.removeChild(root)
  })

  it("returns settled controls when scope is unattached", async () => {
    let dispose_: (() => void) | null = null
    let api: ReturnType<typeof createAnimate> | null = null
    createRoot((dispose) => {
      dispose_ = dispose
      api = createAnimate()
    })
    const controls = api!.animate(".missing", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
    dispose_!()
  })
})
