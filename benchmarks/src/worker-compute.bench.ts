import { type WorkerAnimSpec, computeValues, createWorkerComputer } from "@kinem/core"
import { bench, describe } from "vitest"

/**
 * End-to-end measurement of the worker computer wrapper. The interesting
 * delta is the per-call overhead the wrapper adds on top of raw
 * `computeValues`: dispatch through the Computer interface, Promise
 * allocation in `compute()`, and the inline fallback path.
 *
 * Real Worker mode isn't measured here because vitest's node environment
 * has no `Worker` constructor and the cross-thread cost is dominated by
 * `postMessage` structured-clone of the spec list, which is browser-
 * specific and not stable enough to bench meaningfully in node.
 */

function makeSpecs(n: number): WorkerAnimSpec[] {
  const specs: WorkerAnimSpec[] = []
  for (let i = 0; i < n; i++) {
    specs.push({
      id: `el${i}`,
      startTime: 0,
      duration: 1000,
      easing: "ease-out",
      properties: { x: [0, i], y: [0, i * 2], opacity: [0, 1] },
    })
  }
  return specs
}

describe("createWorkerComputer setup", () => {
  bench("inline mode", () => {
    createWorkerComputer({ mode: "inline" }).terminate()
  })
})

describe("Computer.computeSync (inline) vs raw: 100 animations", () => {
  const specs = makeSpecs(100)
  const computer = createWorkerComputer({ mode: "inline" })
  bench("computer.computeSync", () => {
    computer.computeSync(specs, 500)
  })
  bench("raw computeValues", () => {
    computeValues(specs, 500)
  })
})

describe("Computer.compute (inline, Promise round-trip): 1000 animations", () => {
  const specs = makeSpecs(1000)
  const computer = createWorkerComputer({ mode: "inline" })
  bench("computer.compute", async () => {
    await computer.compute(specs, 500)
  })
})
