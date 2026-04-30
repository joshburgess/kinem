import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inView } from "./in-view"

interface FakeObserver {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  observed: Element[]
  disconnected: boolean
}

const observers: FakeObserver[] = []

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root: Document | Element | null = null
  readonly rootMargin: string = ""
  readonly thresholds: readonly number[] = []
  private readonly fake: FakeObserver
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.fake = { callback, options, observed: [], disconnected: false }
    observers.push(this.fake)
  }
  observe(target: Element): void {
    this.fake.observed.push(target)
  }
  unobserve(): void {}
  disconnect(): void {
    this.fake.disconnected = true
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

const fakeEntry = (target: Element, isIntersecting: boolean): IntersectionObserverEntry =>
  ({
    target,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: {} as DOMRectReadOnly,
    rootBounds: null,
    intersectionRect: {} as DOMRectReadOnly,
    time: 0,
  }) as IntersectionObserverEntry

const originalIO = (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver

beforeEach(() => {
  observers.length = 0
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver
})

afterEach(() => {
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = originalIO
})

describe("inView (svelte action)", () => {
  it("calls onEnter and onLeave on intersection transitions", () => {
    const el = document.createElement("div")
    const onEnter = vi.fn()
    const onLeave = vi.fn()
    inView(el, { onEnter, onLeave })
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    expect(onEnter).toHaveBeenCalledTimes(1)
    obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it("dispatches inviewchange events", () => {
    const el = document.createElement("div")
    const events: Array<{ inView: boolean }> = []
    el.addEventListener("inviewchange", (e: Event) => {
      events.push((e as CustomEvent<{ inView: boolean }>).detail)
    })
    inView(el)
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
    expect(events.map((e) => e.inView)).toEqual([true, false])
  })

  it("destroy() disconnects the observer", () => {
    const el = document.createElement("div")
    const ret = inView(el)
    const obs = observers[0]!
    ret.destroy()
    expect(obs.disconnected).toBe(true)
  })
})
