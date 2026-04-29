import { describe, expect, it } from "vitest"
import { omitUndefined } from "./omit-undefined"

describe("omitUndefined", () => {
  it("drops keys whose value is undefined", () => {
    const out = omitUndefined({ a: 1, b: undefined, c: "x" })
    expect(out).toEqual({ a: 1, c: "x" })
    expect("b" in out).toBe(false)
  })

  it("preserves falsy non-undefined values", () => {
    const out = omitUndefined({ a: 0, b: "", c: false, d: null })
    expect(out).toEqual({ a: 0, b: "", c: false, d: null })
  })

  it("handles empty input", () => {
    expect(omitUndefined({})).toEqual({})
  })

  it("returns a fresh object (no mutation)", () => {
    const input = { a: 1, b: undefined }
    const out = omitUndefined(input)
    expect(out).not.toBe(input)
    expect("b" in input).toBe(true)
  })
})
