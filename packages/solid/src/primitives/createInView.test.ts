import { createRoot } from "solid-js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createInView } from "./createInView"

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

const fakeEl = (): Element => ({}) as Element

describe("createInView (solid)", () => {
  it("flips inView on intersection", () => {
    createRoot((dispose) => {
      const r = createInView<HTMLDivElement>()
      const el = fakeEl() as HTMLDivElement
      r.ref(el)
      expect(r.inView()).toBe(false)
      const obs = observers[0]!
      obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
      expect(r.inView()).toBe(true)
      obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
      expect(r.inView()).toBe(false)
      dispose()
    })
  })

  it("disconnects on dispose", () => {
    createRoot((dispose) => {
      const r = createInView<HTMLDivElement>()
      r.ref(fakeEl() as HTMLDivElement)
      const obs = observers[0]!
      dispose()
      expect(obs.disconnected).toBe(true)
    })
  })
})
