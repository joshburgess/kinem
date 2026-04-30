// @vitest-environment happy-dom

import { describe, expect, it } from "vitest"
import { kinemAnimate } from "./animate"

describe("kinemAnimate (svelte)", () => {
  it("animates elements matching the selector inside scope", async () => {
    const root = document.createElement("ul")
    root.innerHTML = `<li class="row"></li><li class="row"></li>`
    document.body.appendChild(root)
    const api = kinemAnimate(root)
    const controls = api.animate("li.row", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
    document.body.removeChild(root)
  })

  it("returns settled controls when no targets match", async () => {
    const root = document.createElement("div")
    document.body.appendChild(root)
    const api = kinemAnimate(root)
    const controls = api.animate(".missing", { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
    document.body.removeChild(root)
  })

  it("accepts a direct element as target", async () => {
    const root = document.createElement("div")
    const inner = document.createElement("span")
    root.appendChild(inner)
    document.body.appendChild(root)
    const api = kinemAnimate(root)
    const controls = api.animate(inner, { opacity: [0, 1] }, { duration: 1 })
    await controls.finished
    document.body.removeChild(root)
  })
})
