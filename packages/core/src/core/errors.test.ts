import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import { KinemError } from "./errors"

describe("KinemError", () => {
  it("prefixes the message with `kinem:`", () => {
    const err = new KinemError("oh no")
    expect(err.message).toBe("kinem: oh no")
    expect(err.hint).toBe("")
  })

  it("appends the hint when provided", () => {
    const err = new KinemError("bad input", "use foo() instead")
    expect(err.message).toBe("kinem: bad input - use foo() instead")
    expect(err.hint).toBe("use foo() instead")
  })

  it("is an instance of Error and has name 'KinemError'", () => {
    const err = new KinemError("x")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("KinemError")
  })

  it("is thrown by user-facing APIs on bad input", () => {
    expect(() =>
      tween({ opacity: [0, 1, 2] as unknown as readonly [number, number] }, { duration: 100 }),
    ).toThrowError(KinemError)
  })
})
