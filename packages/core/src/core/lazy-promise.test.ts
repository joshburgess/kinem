import { describe, expect, it, vi } from "vitest"
import { createLazyPromise } from "./lazy-promise"

describe("createLazyPromise", () => {
  it("resolves synchronously without allocating a Promise if never accessed", async () => {
    const lp = createLazyPromise()
    lp.resolve()
    expect(lp.settled).toBe(true)
    // Accessing .promise after settle returns a pre-resolved Promise.
    await expect(lp.promise).resolves.toBeUndefined()
  })

  it("rejects synchronously without allocating a Promise if never accessed", async () => {
    const lp = createLazyPromise()
    const err = new Error("x")
    lp.reject(err)
    expect(lp.settled).toBe(true)
    await expect(lp.promise).rejects.toBe(err)
  })

  it("resolves when accessed before settlement", async () => {
    const lp = createLazyPromise()
    const p = lp.promise
    lp.resolve()
    await expect(p).resolves.toBeUndefined()
  })

  it("rejects when accessed before settlement", async () => {
    const lp = createLazyPromise()
    const p = lp.promise
    const err = new Error("y")
    lp.reject(err)
    await expect(p).rejects.toBe(err)
  })

  it("ignores settlement after first settle", async () => {
    const lp = createLazyPromise()
    lp.resolve()
    lp.reject(new Error("ignored"))
    await expect(lp.promise).resolves.toBeUndefined()
  })

  it("returns the same Promise instance on repeated access", () => {
    const lp = createLazyPromise()
    const a = lp.promise
    const b = lp.promise
    expect(a).toBe(b)
  })

  it("does not surface unhandled rejection when rejected before access", async () => {
    // When .promise is first accessed after rejection, the helper must
    // attach a silent catch so discarding the returned promise doesn't
    // trip Node's unhandled-rejection handler. Callers that chain still
    // observe the rejection.
    const handler = vi.fn()
    process.on("unhandledRejection", handler)
    try {
      const lp = createLazyPromise()
      lp.reject(new Error("silent"))
      // Access and discard.
      void lp.promise
      // Independent subscription must still observe the rejection.
      await expect(lp.promise).rejects.toThrow("silent")
      await new Promise((r) => setTimeout(r, 0))
      expect(handler).not.toHaveBeenCalled()
    } finally {
      process.off("unhandledRejection", handler)
    }
  })

  it("pending -> rejected settlement surfaces through awaiters", async () => {
    const lp = createLazyPromise()
    const awaiter = (async () => {
      try {
        await lp.promise
        return "resolved"
      } catch (e) {
        return (e as Error).message
      }
    })()
    lp.reject(new Error("z"))
    expect(await awaiter).toBe("z")
  })
})
