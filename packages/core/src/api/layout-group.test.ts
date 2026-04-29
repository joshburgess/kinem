import { describe, expect, it } from "vitest"
import { createLayoutGroup, defaultLayoutGroup } from "./layout-group"

const rect = (left: number, top: number, width = 10, height = 10) => ({
  left,
  top,
  width,
  height,
})

describe("createLayoutGroup", () => {
  it("captures and consumes a snapshot exactly once", () => {
    const g = createLayoutGroup()
    g.capture("a", rect(10, 20))
    const first = g.consume("a")
    expect(first?.rect.left).toBe(10)
    expect(first?.rect.top).toBe(20)
    expect(g.consume("a")).toBeUndefined()
  })

  it("peek returns the snapshot without consuming it", () => {
    const g = createLayoutGroup()
    g.capture("a", rect(1, 2))
    expect(g.peek("a")?.rect.left).toBe(1)
    expect(g.peek("a")?.rect.left).toBe(1)
    expect(g.consume("a")?.rect.left).toBe(1)
    expect(g.peek("a")).toBeUndefined()
  })

  it("release explicitly drops a snapshot", () => {
    const g = createLayoutGroup()
    g.capture("a", rect(0, 0))
    g.release("a")
    expect(g.consume("a")).toBeUndefined()
  })

  it("capture replaces a prior snapshot for the same id", () => {
    const g = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    g.capture("a", rect(1, 1))
    g.capture("a", rect(2, 2))
    expect(g.consume("a")?.rect.left).toBe(2)
  })

  it("treats stale snapshots as missing on read (consume)", () => {
    let t = 1000
    const g = createLayoutGroup({ ttl: 50, now: () => t })
    g.capture("a", rect(0, 0))
    t += 100
    expect(g.consume("a")).toBeUndefined()
  })

  it("treats stale snapshots as missing on read (peek) and evicts them", () => {
    let t = 1000
    const g = createLayoutGroup({ ttl: 50, now: () => t })
    g.capture("a", rect(0, 0))
    t += 100
    expect(g.peek("a")).toBeUndefined()
    // A subsequent consume should also see nothing because peek evicted.
    expect(g.consume("a")).toBeUndefined()
  })

  it("respects ttl=Infinity", () => {
    let t = 0
    const g = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY, now: () => t })
    g.capture("a", rect(5, 5))
    t = 10_000_000
    expect(g.consume("a")?.rect.left).toBe(5)
  })

  it("clear drops every snapshot", () => {
    const g = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY })
    g.capture("a", rect(0, 0))
    g.capture("b", rect(1, 1))
    g.clear()
    expect(g.consume("a")).toBeUndefined()
    expect(g.consume("b")).toBeUndefined()
  })

  it("snapshot.capturedAt is sourced from the supplied clock", () => {
    const g = createLayoutGroup({ ttl: Number.POSITIVE_INFINITY, now: () => 42 })
    g.capture("a", rect(0, 0))
    expect(g.peek("a")?.capturedAt).toBe(42)
  })
})

describe("defaultLayoutGroup", () => {
  it("is a usable LayoutGroup", () => {
    defaultLayoutGroup.capture("global-test-id", rect(7, 8))
    const s = defaultLayoutGroup.consume("global-test-id")
    expect(s?.rect.left).toBe(7)
    expect(s?.rect.top).toBe(8)
  })
})
