import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useInView } from "./useInView"

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

describe("useInView", () => {
  it("starts with inView=false and flips to true on intersection", () => {
    let captured = false
    function Probe() {
      const { ref, inView } = useInView<HTMLDivElement>()
      captured = inView
      return <div ref={ref} />
    }
    const { container } = render(<Probe />)
    expect(captured).toBe(false)
    const obs = observers[0]!
    const el = container.querySelector("div")!
    act(() => {
      obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    })
    expect(captured).toBe(true)
  })

  it("flips back to false on exit when not once", () => {
    let captured = false
    function Probe() {
      const { ref, inView } = useInView<HTMLDivElement>()
      captured = inView
      return <div ref={ref} />
    }
    const { container } = render(<Probe />)
    const obs = observers[0]!
    const el = container.querySelector("div")!
    act(() => {
      obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    })
    expect(captured).toBe(true)
    act(() => {
      obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
    })
    expect(captured).toBe(false)
  })

  it("disconnects on unmount", () => {
    function Probe() {
      const { ref } = useInView<HTMLDivElement>()
      return <div ref={ref} />
    }
    const { unmount } = render(<Probe />)
    const obs = observers[0]!
    unmount()
    expect(obs.disconnected).toBe(true)
  })
})
