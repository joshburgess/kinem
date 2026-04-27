import {
  interpolateColor,
  interpolateNumber,
  interpolatePath,
  interpolateTransform,
  interpolateUnit,
  parsePath,
  parseTransform,
  parseUnit,
} from "@kinem/core"
import { bench, describe } from "vitest"

/**
 * Per-call cost of each built-in interpolator at p=0.5. The mass-
 * interpolation bench mixes these together so a 2x regression in any
 * single one is hard to spot. This file pins each one separately so a
 * PR that, e.g., slows color blending shows up directly.
 *
 * Every kinem interpolator is a thunk factory: `interpolateX(from, to)`
 * returns `(progress) => value`. Construction may parse + cache; the
 * thunk is the per-frame hot path. Both phases get separate benches so
 * regressions in either show up cleanly.
 */

describe("number interpolation", () => {
  const fn = interpolateNumber(0, 100)
  bench("build thunk", () => {
    interpolateNumber(0, 100)
  })
  bench("call thunk", () => {
    fn(0.5)
  })
})

describe("unit interpolation", () => {
  const fn = interpolateUnit("0px", "100px")
  bench("parseUnit", () => {
    parseUnit("100px")
  })
  bench("build thunk", () => {
    interpolateUnit("0px", "100px")
  })
  bench("call thunk", () => {
    fn(0.5)
  })
})

describe("color interpolation", () => {
  const rgb = interpolateColor("rgb(255, 0, 0)", "rgb(0, 0, 255)")
  const hex = interpolateColor("#ff0000", "#0000ff")
  const hsl = interpolateColor("hsl(0, 100%, 50%)", "hsl(240, 100%, 50%)")
  bench("build thunk: rgb", () => {
    interpolateColor("rgb(255, 0, 0)", "rgb(0, 0, 255)")
  })
  bench("call: rgb", () => {
    rgb(0.5)
  })
  bench("call: hex", () => {
    hex(0.5)
  })
  bench("call: hsl", () => {
    hsl(0.5)
  })
})

describe("transform interpolation", () => {
  const a = "translate(0px, 0px) rotate(0deg) scale(1)"
  const b = "translate(100px, 50px) rotate(180deg) scale(1.5)"
  const fn = interpolateTransform(a, b)
  bench("parseTransform", () => {
    parseTransform(b)
  })
  bench("build thunk", () => {
    interpolateTransform(a, b)
  })
  bench("call thunk", () => {
    fn(0.5)
  })
})

describe("path interpolation", () => {
  const a = "M0 0 L100 0 L100 100 L0 100 Z"
  const b = "M50 0 L100 50 L50 100 L0 50 Z"
  const fn = interpolatePath(a, b)
  bench("parsePath", () => {
    parsePath(b)
  })
  bench("build thunk", () => {
    interpolatePath(a, b)
  })
  bench("call thunk", () => {
    fn(0.5)
  })
})
