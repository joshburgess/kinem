import { describe, expect, it } from "vitest"
import { createBatch } from "./batch"

describe("batch", () => {
  it("runs all reads before any writes within a flush", async () => {
    const b = createBatch()
    const log: string[] = []
    const rp = b.read(() => {
      log.push("r1")
      return 1
    })
    b.write(() => log.push("w1"))
    b.read(() => {
      log.push("r2")
      return 2
    })
    b.write(() => log.push("w2"))
    const { reads, writes } = b.flush()
    expect(reads).toBe(2)
    expect(writes).toBe(2)
    expect(log).toEqual(["r1", "r2", "w1", "w2"])
    await expect(rp).resolves.toBe(1)
  })

  it("returns read values through the promise", async () => {
    const b = createBatch()
    const p = b.read(() => 42)
    b.flush()
    await expect(p).resolves.toBe(42)
  })

  it("rejects the promise when a read throws", async () => {
    const b = createBatch()
    const p = b.read(() => {
      throw new Error("boom")
    })
    b.flush()
    await expect(p).rejects.toThrow("boom")
  })

  it("rejects the promise when a write throws but continues the flush", async () => {
    const b = createBatch()
    const log: string[] = []
    const p = b.write(() => {
      throw new Error("nope")
    })
    b.write(() => log.push("after"))
    b.flush()
    await expect(p).rejects.toThrow("nope")
    expect(log).toEqual(["after"])
  })

  it("writes enqueued during a read run in the same flush, after reads", () => {
    const b = createBatch()
    const log: string[] = []
    b.read(() => {
      log.push("r1")
      b.write(() => log.push("w-from-read"))
      return null
    })
    b.write(() => log.push("w-original"))
    const stats = b.flush()
    expect(stats).toEqual({ reads: 1, writes: 2 })
    expect(log).toEqual(["r1", "w-original", "w-from-read"])
  })

  it("reads enqueued during a read defer to the next flush", () => {
    const b = createBatch()
    const log: string[] = []
    b.read(() => {
      log.push("r1")
      b.read(() => {
        log.push("r-next")
        return null
      })
      return null
    })
    expect(b.flush()).toEqual({ reads: 1, writes: 0 })
    expect(log).toEqual(["r1"])
    expect(b.flush()).toEqual({ reads: 1, writes: 0 })
    expect(log).toEqual(["r1", "r-next"])
  })

  it("writes enqueued during a write defer to the next flush", () => {
    const b = createBatch()
    const log: string[] = []
    b.write(() => {
      log.push("w1")
      b.write(() => log.push("w-next"))
    })
    expect(b.flush()).toEqual({ reads: 0, writes: 1 })
    expect(log).toEqual(["w1"])
    expect(b.flush()).toEqual({ reads: 0, writes: 1 })
    expect(log).toEqual(["w1", "w-next"])
  })

  it("nested flush() calls are no-ops", () => {
    const b = createBatch()
    const log: string[] = []
    b.read(() => {
      log.push("r1")
      b.flush()
      return null
    })
    b.flush()
    expect(log).toEqual(["r1"])
  })

  it("reports size of pending queue", () => {
    const b = createBatch()
    expect(b.size).toBe(0)
    b.read(() => 1)
    b.write(() => {})
    expect(b.size).toBe(2)
    b.flush()
    expect(b.size).toBe(0)
  })
})
