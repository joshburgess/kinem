import { __resetTracker, trackAnimation } from "@kinem/core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mountTimeline } from "./timeline"

function fakeControls(overrides: Partial<{ duration: number; state: string }> = {}): {
  state: string
  duration: number
  finished: Promise<void>
  pause: () => void
  resume: () => void
  seek: (progress: number) => void
  cancel: () => void
  pauseSpy: ReturnType<typeof vi.fn>
  resumeSpy: ReturnType<typeof vi.fn>
  seekSpy: ReturnType<typeof vi.fn>
} {
  const pauseSpy = vi.fn()
  const resumeSpy = vi.fn()
  const seekSpy = vi.fn()
  return {
    state: overrides.state ?? "playing",
    duration: overrides.duration ?? 500,
    finished: new Promise<void>(() => {}),
    pause() {
      pauseSpy()
    },
    resume() {
      resumeSpy()
    },
    seek(p: number) {
      seekSpy(p)
    },
    cancel() {},
    pauseSpy,
    resumeSpy,
    seekSpy,
  }
}

afterEach(() => {
  __resetTracker()
  for (const el of Array.from(document.querySelectorAll("[data-kinem-timeline]"))) {
    el.remove()
  }
})

describe("mountTimeline", () => {
  it("mounts a host element and renders empty state", () => {
    const scrubber = mountTimeline()
    expect(document.querySelector("[data-kinem-timeline]")).toBeTruthy()
    expect(scrubber.element.shadowRoot?.querySelector(".empty")?.textContent).toContain("No active")
    scrubber.unmount()
  })

  it("renders one track row per active animation after refresh()", () => {
    const scrubber = mountTimeline()
    trackAnimation(fakeControls() as never, [{ tagName: "DIV", id: "a" }] as never, "waapi")
    trackAnimation(fakeControls() as never, [{ tagName: "SPAN" }] as never, "raf")
    scrubber.refresh()
    const rows = scrubber.element.shadowRoot?.querySelectorAll(".track-row") ?? []
    expect(rows.length).toBe(2)
    scrubber.unmount()
  })

  it("color-codes bars by backend", () => {
    const scrubber = mountTimeline()
    trackAnimation(fakeControls() as never, [{ tagName: "DIV" }] as never, "waapi")
    trackAnimation(fakeControls() as never, [{ tagName: "DIV" }] as never, "raf")
    trackAnimation(fakeControls() as never, [{ tagName: "DIV" }] as never, "auto")
    scrubber.refresh()
    const bars = scrubber.element.shadowRoot?.querySelectorAll(".bar") ?? []
    expect(bars[0]?.classList.contains("waapi")).toBe(true)
    expect(bars[1]?.classList.contains("raf")).toBe(true)
    expect(bars[2]?.classList.contains("auto")).toBe(true)
    scrubber.unmount()
  })

  it("Pause all invokes controls.pause on every active animation", () => {
    const scrubber = mountTimeline()
    const a = fakeControls()
    const b = fakeControls()
    trackAnimation(a as never, [{ tagName: "DIV" }] as never)
    trackAnimation(b as never, [{ tagName: "DIV" }] as never)
    scrubber.refresh()
    const pauseBtn = scrubber.element.shadowRoot?.querySelectorAll(
      ".header button",
    )[0] as HTMLButtonElement
    pauseBtn.click()
    expect(a.pauseSpy).toHaveBeenCalledTimes(1)
    expect(b.pauseSpy).toHaveBeenCalledTimes(1)
    scrubber.unmount()
  })

  it("Resume all invokes controls.resume on every active animation", () => {
    const scrubber = mountTimeline()
    const a = fakeControls({ state: "paused" })
    trackAnimation(a as never, [{ tagName: "DIV" }] as never)
    scrubber.refresh()
    const resumeBtn = scrubber.element.shadowRoot?.querySelectorAll(
      ".header button",
    )[1] as HTMLButtonElement
    resumeBtn.click()
    expect(a.resumeSpy).toHaveBeenCalledTimes(1)
    scrubber.unmount()
  })

  it("unmount removes the host element", () => {
    const scrubber = mountTimeline()
    scrubber.unmount()
    expect(document.querySelector("[data-kinem-timeline]")).toBeNull()
  })

  it("collapsed:true sets the collapsed class", () => {
    const scrubber = mountTimeline({ collapsed: true })
    const panel = scrubber.element.shadowRoot?.querySelector(".panel")
    expect(panel?.classList.contains("collapsed")).toBe(true)
    scrubber.unmount()
  })

  it("position:top applies the top class", () => {
    const scrubber = mountTimeline({ position: "top" })
    const panel = scrubber.element.shadowRoot?.querySelector(".panel")
    expect(panel?.classList.contains("top")).toBe(true)
    scrubber.unmount()
  })

  it("unmount is idempotent", () => {
    const scrubber = mountTimeline()
    scrubber.unmount()
    expect(() => scrubber.unmount()).not.toThrow()
  })

  it("toggle button collapses and expands the panel", () => {
    const scrubber = mountTimeline()
    const toggle = scrubber.element.shadowRoot?.querySelectorAll(
      ".header button",
    )[2] as HTMLButtonElement
    const panel = scrubber.element.shadowRoot?.querySelector(".panel") as HTMLElement
    expect(panel.classList.contains("collapsed")).toBe(false)
    expect(toggle.textContent).toBe("-")
    toggle.click()
    expect(panel.classList.contains("collapsed")).toBe(true)
    expect(toggle.textContent).toBe("+")
    toggle.click()
    expect(panel.classList.contains("collapsed")).toBe(false)
    scrubber.unmount()
  })

  it("dragging the playhead seeks every active animation", () => {
    // jsdom's getBoundingClientRect returns zeros by default. render() rebuilds
    // .lane on each call, so stubbing the instance won't survive the next
    // updateScrub. Stub the prototype for the duration of this test instead.
    const origRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.classList?.contains("lane")) {
        return {
          x: 0,
          y: 0,
          left: 0,
          right: 100,
          top: 0,
          bottom: 14,
          width: 100,
          height: 14,
          toJSON() {
            return {}
          },
        } as DOMRect
      }
      return origRect.call(this)
    }
    try {
      const scrubber = mountTimeline()
      const a = fakeControls()
      trackAnimation(a as never, [{ tagName: "DIV" }] as never)
      scrubber.refresh()

      const hit = scrubber.element.shadowRoot?.querySelector(".playhead-hit") as HTMLElement
      // Skip pointer-capture calls jsdom doesn't implement.
      hit.setPointerCapture = () => {}
      hit.releasePointerCapture = () => {}

      const mkEvent = (type: string, x: number): PointerEvent =>
        new PointerEvent(type, { clientX: x, pointerId: 1, bubbles: true })

      hit.dispatchEvent(mkEvent("pointerdown", 25))
      expect(a.pauseSpy).toHaveBeenCalled()
      expect(a.seekSpy).toHaveBeenCalledWith(0.25)

      hit.dispatchEvent(mkEvent("pointermove", 75))
      expect(a.seekSpy).toHaveBeenLastCalledWith(0.75)

      hit.dispatchEvent(mkEvent("pointerup", 75))
      // Playhead should hide once the scrub finishes.
      const playhead = scrubber.element.shadowRoot?.querySelector(".playhead") as HTMLElement
      expect(playhead.style.display).toBe("none")
      scrubber.unmount()
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origRect
    }
  })

  it("pointermove without a prior pointerdown is a no-op", () => {
    const scrubber = mountTimeline()
    const a = fakeControls()
    trackAnimation(a as never, [{ tagName: "DIV" }] as never)
    scrubber.refresh()
    const hit = scrubber.element.shadowRoot?.querySelector(".playhead-hit") as HTMLElement
    hit.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, bubbles: true }))
    expect(a.seekSpy).not.toHaveBeenCalled()
    scrubber.unmount()
  })

  it("pointerdown with no active animations is a no-op", () => {
    const scrubber = mountTimeline()
    const hit = scrubber.element.shadowRoot?.querySelector(".playhead-hit") as HTMLElement
    hit.setPointerCapture = () => {}
    expect(() =>
      hit.dispatchEvent(
        new PointerEvent("pointerdown", { clientX: 10, pointerId: 1, bubbles: true }),
      ),
    ).not.toThrow()
    scrubber.unmount()
  })

  it("renders fallback labels for targets with no tagName or no targets at all", () => {
    const scrubber = mountTimeline()
    trackAnimation(fakeControls() as never, [] as never, "auto")
    trackAnimation(fakeControls() as never, [{}] as never, "auto")
    trackAnimation(
      fakeControls() as never,
      [{ tagName: "DIV" }, { tagName: "DIV" }, { tagName: "DIV" }] as never,
      "auto",
    )
    scrubber.refresh()
    const labels = Array.from(
      scrubber.element.shadowRoot?.querySelectorAll(".label > span:last-child") ?? [],
    ).map((n) => n.textContent ?? "")
    expect(labels[0]).toBe("(no targets)")
    expect(labels[1]).toBe("(unknown)")
    expect(labels[2]).toBe("div +2")
    scrubber.unmount()
  })
})
