import { describe, expect, it } from "vitest"
import { createWorkerComputer } from "./worker"
import type { WorkerAnimSpec } from "./worker-protocol"

function sampleSpec(id: string): WorkerAnimSpec {
  return {
    id,
    startTime: 0,
    duration: 100,
    easing: "linear",
    properties: { x: [0, 100] },
  }
}

describe("createWorkerComputer", () => {
  it("falls back to inline when no Worker is available", async () => {
    const computer = createWorkerComputer({ Worker: undefined })
    expect(computer.mode).toBe("inline")
    const values = await computer.compute([sampleSpec("a")], 50)
    expect(values["a"]?.["x"]).toBe(50)
  })

  it("computeSync works in inline mode", () => {
    const computer = createWorkerComputer({ Worker: undefined })
    const values = computer.computeSync([sampleSpec("a")], 50)
    expect(values["a"]?.["x"]).toBe(50)
  })

  it("throws when worker mode is requested but no Worker is available", () => {
    expect(() => createWorkerComputer({ mode: "worker", Worker: undefined })).toThrow(
      /no Worker constructor/,
    )
  })

  it("drives a fake Worker end-to-end", async () => {
    type Listener = (ev: { data: unknown }) => void
    const sent: unknown[] = []
    let msgListener: Listener | null = null
    const FakeWorker = class {
      postMessage(msg: unknown) {
        sent.push(msg)
        // Simulate the worker's self.postMessage echo with computed values.
        const m = msg as { seq: number; specs: readonly WorkerAnimSpec[]; time: number }
        const values: Record<string, Record<string, number>> = {}
        for (const s of m.specs) {
          const eased = Math.max(0, Math.min(1, (m.time - s.startTime) / s.duration))
          const range = s.properties["x"]
          values[s.id] = {
            x: (range?.[0] ?? 0) * (1 - eased) + (range?.[1] ?? 0) * eased,
          }
        }
        queueMicrotask(() => {
          msgListener?.({ data: { type: "values", seq: m.seq, values } })
        })
      }
      terminate() {}
      addEventListener(_type: string, cb: Listener) {
        msgListener = cb
      }
      removeEventListener() {
        msgListener = null
      }
    } as unknown as Parameters<typeof createWorkerComputer>[0] extends infer O
      ? O extends { Worker?: infer W }
        ? W
        : never
      : never

    const computer = createWorkerComputer({
      mode: "worker",
      Worker: FakeWorker,
      workerUrl: () => "blob:fake",
    })
    expect(computer.mode).toBe("worker")

    const [a, b] = await Promise.all([
      computer.compute([sampleSpec("a")], 25),
      computer.compute([sampleSpec("b")], 75),
    ])

    expect(a["a"]?.["x"]).toBe(25)
    expect(b["b"]?.["x"]).toBe(75)
    expect(sent).toHaveLength(2)
    computer.terminate()
  })
})
