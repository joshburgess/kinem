import { __resetTracker, trackAnimation } from "motif-animate"
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
  for (const el of Array.from(document.querySelectorAll("[data-motif-timeline]"))) {
    el.remove()
  }
})

describe("mountTimeline", () => {
  it("mounts a host element and renders empty state", () => {
    const scrubber = mountTimeline()
    expect(document.querySelector("[data-motif-timeline]")).toBeTruthy()
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
    expect(document.querySelector("[data-motif-timeline]")).toBeNull()
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
})
