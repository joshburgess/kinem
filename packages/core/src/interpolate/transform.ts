/**
 * CSS transform interpolation.
 *
 * Parses a `transform` string into an ordered list of function calls, then
 * interpolates each function's arguments independently. Rotations use the
 * shortest-arc direction.
 *
 * The from/to strings must share the same function structure (same
 * functions in the same order). Mismatched structure throws; mixing
 * different transform expressions will be handled in a later pass by
 * normalizing into a 4x4 matrix.
 */

import { KinemError } from "../core/errors"
import { interpolateNumber } from "./number"
import { interpolateUnit, parseUnit } from "./units"

interface TransformFn {
  readonly name: string
  readonly args: readonly string[]
}

const FN_RE = /([a-zA-Z0-9]+)\s*\(([^)]*)\)/g

export function parseTransform(input: string): readonly TransformFn[] {
  const out: TransformFn[] = []
  const str = input.trim()
  if (str === "" || str === "none") return out
  let m: RegExpExecArray | null
  FN_RE.lastIndex = 0
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop idiom
  while ((m = FN_RE.exec(str)) !== null) {
    const name = (m[1] ?? "").toLowerCase()
    const args = (m[2] ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
    out.push({ name, args })
  }
  return out
}

const ANGLE_UNITS = new Set(["deg", "rad", "turn", "grad"])

const toDeg = (value: number, unit: string): number => {
  if (unit === "" || unit === "deg") return value
  if (unit === "rad") return (value * 180) / Math.PI
  if (unit === "turn") return value * 360
  if (unit === "grad") return value * 0.9
  return value
}

const fromDeg = (deg: number, unit: string): number => {
  if (unit === "" || unit === "deg") return deg
  if (unit === "rad") return (deg * Math.PI) / 180
  if (unit === "turn") return deg / 360
  if (unit === "grad") return deg / 0.9
  return deg
}

const shortestAngleDelta = (fromDegVal: number, toDegVal: number): number => {
  let d = toDegVal - fromDegVal
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

function interpolateAngleArg(from: string, to: string): (progress: number) => string {
  const a = parseUnit(from)
  const b = parseUnit(to)
  if (!a || !b)
    throw new KinemError(
      `interpolate: cannot parse angle args "${from}", "${to}"`,
      "use a number with an angle unit (deg, rad, turn, grad)",
    )
  const outUnit = b.unit || a.unit || "deg"
  if (!ANGLE_UNITS.has(outUnit))
    throw new KinemError(
      `interpolate: unsupported angle unit "${outUnit}"`,
      "use deg, rad, turn, or grad",
    )
  const fromDegVal = toDeg(a.value, a.unit)
  const toDegVal = toDeg(b.value, b.unit)
  const delta = shortestAngleDelta(fromDegVal, toDegVal)
  return (p) => {
    const deg = fromDegVal + delta * p
    const v = fromDeg(deg, outUnit)
    return `${v}${outUnit}`
  }
}

function interpolateFnArg(fn: string, from: string, to: string): (progress: number) => string {
  if (fn.startsWith("rotate") || fn.startsWith("skew")) {
    return interpolateAngleArg(from, to)
  }
  if (fn.startsWith("scale") || fn === "perspective") {
    const a = Number.parseFloat(from)
    const b = Number.parseFloat(to)
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new KinemError(`interpolate: cannot parse ${fn} arg "${from}", "${to}"`)
    }
    const interp = interpolateNumber(a, b)
    const unit = fn === "perspective" ? "px" : ""
    return (p) => `${interp(p)}${unit}`
  }
  if (fn.startsWith("translate")) {
    return interpolateUnit(from, to)
  }
  // Fallback: unitless number
  const a = Number.parseFloat(from)
  const b = Number.parseFloat(to)
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    const interp = interpolateNumber(a, b)
    return (p) => `${interp(p)}`
  }
  throw new KinemError(
    `interpolate: unsupported transform function "${fn}" with args "${from}" / "${to}"`,
  )
}

export function interpolateTransform(from: string, to: string): (progress: number) => string {
  const fromFns = parseTransform(from)
  const toFns = parseTransform(to)
  if (fromFns.length !== toFns.length) {
    throw new KinemError(
      `interpolate: transform structure mismatch: "${from}" (${fromFns.length} fns) vs "${to}" (${toFns.length} fns)`,
      "from and to must contain the same transform functions in the same order",
    )
  }
  const pairs: Array<{ name: string; argFns: Array<(p: number) => string> }> = []
  for (let i = 0; i < fromFns.length; i++) {
    const a = fromFns[i] as TransformFn
    const b = toFns[i] as TransformFn
    if (a.name !== b.name) {
      throw new KinemError(
        `interpolate: transform function mismatch at index ${i}: ${a.name} vs ${b.name}`,
        "from and to must contain the same transform functions in the same order",
      )
    }
    if (a.args.length !== b.args.length) {
      throw new KinemError(
        `interpolate: ${a.name}() arg count mismatch: ${a.args.length} vs ${b.args.length}`,
      )
    }
    const argFns: Array<(p: number) => string> = []
    for (let j = 0; j < a.args.length; j++) {
      argFns.push(interpolateFnArg(a.name, a.args[j] ?? "", b.args[j] ?? ""))
    }
    pairs.push({ name: a.name, argFns })
  }

  return (p) => {
    const parts: string[] = []
    for (const { name, argFns } of pairs) {
      const rendered = argFns.map((fn) => fn(p)).join(", ")
      parts.push(`${name}(${rendered})`)
    }
    return parts.join(" ")
  }
}
