import { __resetTracker, trackAnimation } from "kinem"
import { afterEach, describe, expect, it } from "vitest"
import { mountInspector } from "./overlay"

function pending(): Promise<void> {
  return new Promise<void>(() => {})
}

afterEach(() => {
  __resetTracker()
  for (const el of Array.from(document.querySelectorAll("[data-kinem-inspector]"))) {
    el.remove()
  }
})

describe("mountInspector", () => {
  it("mounts a host element into document.body by default", () => {
    const panel = mountInspector()
    expect(document.querySelector("[data-kinem-inspector]")).toBeTruthy()
    panel.unmount()
  })

  it("unmount removes the host element", () => {
    const panel = mountInspector()
    panel.unmount()
    expect(document.querySelector("[data-kinem-inspector]")).toBeNull()
  })

  it("renders an empty state when no animations are active", () => {
    const panel = mountInspector()
    const shadow = panel.element.shadowRoot
    if (!shadow) throw new Error("no shadow root")
    expect(shadow.querySelector(".empty")?.textContent).toContain("No active")
    panel.unmount()
  })

  it("renders a row per active animation after refresh()", () => {
    const panel = mountInspector()
    trackAnimation(
      { state: "playing", duration: 500, finished: pending() } as never,
      [{ tagName: "DIV", id: "a" }] as never,
    )
    trackAnimation(
      { state: "playing", duration: 500, finished: pending() } as never,
      [{ tagName: "SPAN" }] as never,
    )
    panel.refresh()
    const rows = panel.element.shadowRoot?.querySelectorAll(".row") ?? []
    expect(rows.length).toBe(2)
    panel.unmount()
  })

  it("shows the target label including id and tag", () => {
    const panel = mountInspector()
    trackAnimation(
      { state: "playing", duration: 500, finished: pending() } as never,
      [{ tagName: "DIV", id: "hero", className: "card big" }] as never,
    )
    panel.refresh()
    const label = panel.element.shadowRoot?.querySelector(".row .target")
    expect(label?.textContent).toBe("div#hero.card.big")
    panel.unmount()
  })

  it("applies the configured position class", () => {
    const panel = mountInspector({ position: "top-left" })
    const p = panel.element.shadowRoot?.querySelector(".panel")
    expect(p?.classList.contains("top-left")).toBe(true)
    panel.unmount()
  })

  it("respects `parent` option", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const panel = mountInspector({ parent: host })
    expect(host.querySelector("[data-kinem-inspector]")).toBeTruthy()
    panel.unmount()
    host.remove()
  })

  it("collapsed:true renders without the body visible", () => {
    const panel = mountInspector({ collapsed: true })
    const p = panel.element.shadowRoot?.querySelector(".panel")
    expect(p?.classList.contains("collapsed")).toBe(true)
    panel.unmount()
  })

  it("unmount is idempotent", () => {
    const panel = mountInspector()
    panel.unmount()
    expect(() => panel.unmount()).not.toThrow()
  })
})
