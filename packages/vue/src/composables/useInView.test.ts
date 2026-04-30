// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { defineComponent, h, nextTick } from "vue"
import { type UseInViewResult, useInView } from "./useInView"

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

describe("useInView (vue)", () => {
  it("starts inView=false and flips on intersection", async () => {
    let result: UseInViewResult<HTMLDivElement> | null = null
    const Comp = defineComponent({
      setup() {
        const r = useInView<HTMLDivElement>()
        result = r
        return () => h("div", { ref: r.elRef })
      },
    })
    mount(Comp, { attachTo: document.body })
    await nextTick()
    expect(result!.inView.value).toBe(false)
    const obs = observers[0]!
    const el = obs.observed[0]!
    obs.callback([fakeEntry(el, true)], {} as IntersectionObserver)
    expect(result!.inView.value).toBe(true)
    obs.callback([fakeEntry(el, false)], {} as IntersectionObserver)
    expect(result!.inView.value).toBe(false)
  })

  it("disconnects on unmount", async () => {
    const Comp = defineComponent({
      setup() {
        const r = useInView<HTMLDivElement>()
        return () => h("div", { ref: r.elRef })
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await nextTick()
    const obs = observers[0]!
    wrapper.unmount()
    expect(obs.disconnected).toBe(true)
  })
})
