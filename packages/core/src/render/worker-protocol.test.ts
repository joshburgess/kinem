import { describe, expect, it } from "vitest"
import { type WorkerAnimSpec, computeValues } from "./worker-protocol"

function spec(over: Partial<WorkerAnimSpec> & { id: string }): WorkerAnimSpec {
  return {
    startTime: 0,
    duration: 100,
    easing: "linear",
    properties: { x: [0, 100] },
    ...over,
  }
}

describe("computeValues", () => {
  it("linearly interpolates a single spec across its duration", () => {
    const specs = [spec({ id: "a", properties: { x: [0, 100] } })]
    expect(computeValues(specs, 0)).toEqual({ a: { x: 0 } })
    expect(computeValues(specs, 50)).toEqual({ a: { x: 50 } })
    expect(computeValues(specs, 100)).toEqual({})
  })

  it("holds final value when holdAtEnd is set", () => {
    const specs = [spec({ id: "a", holdAtEnd: true })]
    const out = computeValues(specs, 200)
    expect(out["a"]?.["x"]).toBe(100)
  })

  it("applies ease-out and ease-in-out", () => {
    const out = computeValues(
      [spec({ id: "a", easing: "ease-out", properties: { x: [0, 1] } })],
      50,
    )
    expect(out["a"]?.["x"]).toBeCloseTo(0.75, 5)

    const io = computeValues(
      [spec({ id: "b", easing: "ease-in-out", properties: { x: [0, 1] } })],
      50,
    )
    expect(io["b"]?.["x"]).toBeCloseTo(0.5, 5)
  })

  it("applies a cubic-bezier easing", () => {
    const out = computeValues(
      [
        spec({
          id: "a",
          easing: { kind: "cubic-bezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
          properties: { x: [0, 100] },
        }),
      ],
      50,
    )
    expect(out["a"]?.["x"]).toBeCloseTo(50, 5)
  })

  it("applies steps easing", () => {
    const out = computeValues(
      [
        spec({
          id: "a",
          easing: { kind: "steps", n: 4, position: "end" },
          properties: { x: [0, 100] },
        }),
      ],
      60,
    )
    expect(out["a"]?.["x"]).toBe(50)
  })

  it("zero-duration specs snap to 1", () => {
    const out = computeValues([spec({ id: "a", duration: 0 })], 0)
    expect(out["a"]?.["x"]).toBe(100)
  })

  it("clamps progress at 0 before startTime", () => {
    const specs = [spec({ id: "a", startTime: 100 })]
    expect(computeValues(specs, 50)).toEqual({ a: { x: 0 } })
  })

  it("handles many specs in one call", () => {
    const specs: WorkerAnimSpec[] = []
    for (let i = 0; i < 1000; i++) {
      specs.push(
        spec({
          id: `s${i}`,
          startTime: 0,
          duration: 200,
          properties: { x: [0, i], y: [0, i * 2] },
        }),
      )
    }
    const out = computeValues(specs, 100)
    expect(Object.keys(out)).toHaveLength(1000)
    expect(out["s500"]?.["x"]).toBeCloseTo(250, 5)
    expect(out["s500"]?.["y"]).toBeCloseTo(500, 5)
  })
})
