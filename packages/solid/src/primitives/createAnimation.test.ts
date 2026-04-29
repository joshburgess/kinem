import { tween } from "@kinem/core"
import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { createAnimation } from "./createAnimation"

describe("createAnimation (solid)", () => {
  it("throws when play() is called before ref attaches", () => {
    createRoot((dispose) => {
      const a = createAnimation<HTMLDivElement>()
      expect(() => a.play(tween({ opacity: [0, 1] }, { duration: 50 }))).toThrow()
      dispose()
    })
  })

  it("plays an animation against the bound element", async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const a = createAnimation<HTMLDivElement>()
        const el = document.createElement("div")
        a.ref(el)
        const ctl = a.play(tween({ opacity: [0, 1] }, { duration: 30 }))
        ctl.finished.finally(() => {
          dispose()
          resolve()
        })
      })
    })
  })

  it("cancels in-flight animation when play() is called again", () => {
    createRoot((dispose) => {
      const a = createAnimation<HTMLDivElement>()
      const el = document.createElement("div")
      a.ref(el)
      const c1 = a.play(tween({ opacity: [0, 1] }, { duration: 200 }))
      a.play(tween({ opacity: [0, 1] }, { duration: 200 }))
      expect(c1.state).toBe("cancelled")
      dispose()
    })
  })

  it("cancels active animation on cleanup", async () => {
    let dispose!: () => void
    let ctl!: ReturnType<ReturnType<typeof createAnimation<HTMLDivElement>>["play"]>
    createRoot((d) => {
      dispose = d
      const a = createAnimation<HTMLDivElement>()
      const el = document.createElement("div")
      a.ref(el)
      ctl = a.play(tween({ opacity: [0, 1] }, { duration: 500 }))
    })
    dispose()
    expect(ctl.state).toBe("cancelled")
    await ctl.catch(() => {})
  })

  it("state is 'idle' before any play()", () => {
    createRoot((dispose) => {
      const a = createAnimation<HTMLDivElement>()
      expect(a.state).toBe("idle")
      dispose()
    })
  })
})
