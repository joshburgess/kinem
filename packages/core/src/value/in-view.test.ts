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
    this.fake = {
      callback,
      options,
      observed: [],
      disconnected: false,
    }
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

const fakeEntry = (
  target: Element,
  isIntersecting: boolean,
  ratio = isIntersecting ? 1 : 0,
): IntersectionObserverEntry => ({
  target,
  isIntersecting,
  intersectionRatio: ratio,
  boundingClientRect: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRectReadOnly,
  rootBounds: null,
  intersectionRect: {} as DOMRectReadOnly,
  time: 0,
})

const originalIO = (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver

beforeEach(() => {
  observers.length = 0
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver
})

afterEach(() => {
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = originalIO
})

const makeEl = (): Element => {
  const el: Partial<Element> = {}
  return el as Element
}

describe("inView", () => {
  it("calls enter on the first intersecting entry and stays observed", () => {
    const el = makeEl()
    const enter = vi.fn()
    inView(el, enter)
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    expect(enter).toHaveBeenCalledTimes(1)
    expect(obs.disconnected).toBe(false)
  })

  it("disconnects after first enter when once=true", () => {
    const el = makeEl()
    const enter = vi.fn()
    inView(el, enter, { once: true })
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    expect(obs.disconnected).toBe(true)
  })

  it("calls leave on the next exit when enter returns a function", () => {
    const el = makeEl()
    const leave = vi.fn()
    const enter = vi.fn().mockReturnValue(leave)
    inView(el, enter)
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it("does not call enter twice for back-to-back intersecting entries", () => {
    const el = makeEl()
    const enter = vi.fn()
    inView(el, enter)
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    expect(enter).toHaveBeenCalledTimes(1)
  })

  it("re-enters after a leave when not once", () => {
    const el = makeEl()
    const enter = vi.fn()
    inView(el, enter)
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    expect(enter).toHaveBeenCalledTimes(2)
  })

  it("translates amount=all to threshold 1", () => {
    inView(makeEl(), () => {}, { amount: "all" })
    const obs = observers[0]!
    expect(obs.options?.threshold).toBe(1)
  })

  it("translates a numeric amount to that threshold (clamped)", () => {
    inView(makeEl(), () => {}, { amount: 0.42 })
    expect(observers[0]!.options?.threshold).toBeCloseTo(0.42)
    observers.length = 0
    inView(makeEl(), () => {}, { amount: 1.5 })
    expect(observers[0]!.options?.threshold).toBe(1)
  })

  it("stop() disconnects and calls any pending leave with null", () => {
    const el = makeEl()
    const leave = vi.fn()
    const enter = vi.fn().mockReturnValue(leave)
    const stop = inView(el, enter)
    const obs = observers[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    stop()
    expect(obs.disconnected).toBe(true)
    expect(leave).toHaveBeenCalledWith(null)
  })

  it("falls back to optimistic enter when IntersectionObserver is undefined", () => {
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      undefined as unknown
    const el = makeEl()
    const enter = vi.fn()
    const stop = inView(el, enter)
    expect(enter).toHaveBeenCalledTimes(1)
    expect(typeof stop).toBe("function")
    expect(() => stop()).not.toThrow()
  })
})
