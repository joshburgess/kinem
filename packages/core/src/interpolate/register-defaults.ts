/**
 * Registers the built-in interpolators (number, numbers, color,
 * transform, path, CSS units) with the dispatch registry at module
 * load. The main `index.ts` imports this file for its side effect,
 * preserving the default behavior where `tween()`/`keyframes()` handle
 * any common CSS value type out of the box.
 *
 * Kept separate from `registry.ts` so bundles that do not import this
 * module (notably `@kinem/core/slim`) can tree-shake the built-in
 * interpolator code.
 *
 * All built-ins are registered at low priority; user-registered entries
 * remain first-priority.
 */

import { interpolateColor, isColor } from "./color"
import { interpolateNumber } from "./number"
import { interpolateNumbers } from "./numbers"
import { interpolatePath } from "./path"
import { registerInterpolator } from "./registry"
import { interpolateTransform } from "./transform"
import { interpolateUnit, parseUnit } from "./units"

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isNumberArray = (value: unknown): value is readonly number[] => {
  if (!Array.isArray(value) || value.length === 0) return false
  for (let i = 0; i < value.length; i++) {
    const v = value[i]
    if (typeof v !== "number" || !Number.isFinite(v)) return false
  }
  return true
}

const isTransformString = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  return /^(none|\s*[a-zA-Z]+\s*\()/.test(value.trim())
}

const PATH_RE = /^\s*[MmLlHhVvCcSsQqTtAaZz][\s\d+\-,.eE]/

const isPathString = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  return PATH_RE.test(value)
}

const isUnitString = (value: unknown): value is string =>
  typeof value === "string" && parseUnit(value) !== null

registerInterpolator(
  {
    name: "number",
    test: isNumber,
    interpolate: (from, to) => {
      const fn = interpolateNumber(from as number, to as number)
      return (p) => fn(p)
    },
  },
  "low",
)

registerInterpolator(
  {
    name: "numbers",
    test: isNumberArray,
    interpolate: (from, to) => {
      const fn = interpolateNumbers(from as readonly number[], to as readonly number[])
      return (p) => fn(p)
    },
  },
  "low",
)

registerInterpolator(
  {
    name: "color",
    test: (v) => typeof v === "string" && isColor(v),
    interpolate: (from, to) => {
      const fn = interpolateColor(from as string, to as string)
      return (p) => fn(p)
    },
  },
  "low",
)

registerInterpolator(
  {
    name: "transform",
    test: isTransformString,
    interpolate: (from, to) => {
      const fn = interpolateTransform(from as string, to as string)
      return (p) => fn(p)
    },
  },
  "low",
)

registerInterpolator(
  {
    name: "path",
    test: isPathString,
    interpolate: (from, to) => {
      const fn = interpolatePath(from as string, to as string)
      return (p) => fn(p)
    },
  },
  "low",
)

registerInterpolator(
  {
    name: "unit",
    test: isUnitString,
    interpolate: (from, to) => {
      const fn = interpolateUnit(from as string, to as string)
      return (p) => fn(p)
    },
  },
  "low",
)
