import { KinemError } from "../core/errors"

export interface UnitValue {
  readonly value: number
  readonly unit: string
}

const UNIT_RE = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z%]*)\s*$/

/**
 * Parse a CSS length-like string ("100px", "-1.5rem", "50%", "0").
 * Returns `null` if the string does not match a single number+unit pattern.
 */
export function parseUnit(input: string): UnitValue | null {
  const m = UNIT_RE.exec(input)
  if (!m) return null
  const n = Number.parseFloat(m[1] ?? "")
  if (Number.isNaN(n)) return null
  return { value: n, unit: m[2] ?? "" }
}

export class UnitMismatchError extends Error {
  readonly fromUnit: string
  readonly toUnit: string
  constructor(fromUnit: string, toUnit: string) {
    super(`Cannot interpolate between units "${fromUnit}" and "${toUnit}" without DOM context`)
    this.name = "UnitMismatchError"
    this.fromUnit = fromUnit
    this.toUnit = toUnit
  }
}

/**
 * Unit-aware interpolation. Matching units interpolate numerically;
 * a zero-valued unitless side adopts the other's unit (e.g. `"0"` and
 * `"100px"` interpolate as `px`). Mismatched units throw
 * `UnitMismatchError`; the rendering layer is expected to catch these
 * and resolve via DOM measurement.
 */
export function interpolateUnit(from: string, to: string): (progress: number) => string {
  const a = parseUnit(from)
  const b = parseUnit(to)
  if (!a || !b) {
    throw new KinemError(
      `interpolateUnit(): cannot parse unit value (from="${from}" to="${to}")`,
      'expected a number with optional CSS unit, e.g. "100px", "1.5rem", "50%"',
    )
  }

  let unit: string
  if (a.unit === b.unit) {
    unit = a.unit
  } else if (a.unit === "" && a.value === 0) {
    unit = b.unit
  } else if (b.unit === "" && b.value === 0) {
    unit = a.unit
  } else {
    throw new UnitMismatchError(a.unit, b.unit)
  }

  const delta = b.value - a.value
  return (p) => `${a.value + delta * p}${unit}`
}
