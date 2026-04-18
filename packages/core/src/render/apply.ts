/**
 * Apply interpolated property values to a DOM-like target. Splits
 * values by `apply` kind (style | attr | transform), composes any
 * pseudo transform props into a single `transform` string, and writes.
 *
 * This module is DOM-agnostic at the type level. Real browsers pass
 * `Element`; tests can pass a minimal shim with `style` + `setAttribute`.
 */

import { classify, pseudoToTransformFn } from "./properties"

export interface StyleShim {
  setProperty(name: string, value: string): void
}

export interface ElementShim {
  readonly style: StyleShim
  setAttribute(name: string, value: string): void
}

export type PropertyValue = string | number

/** Default units applied to pseudo-transform values when a number is given. */
const PSEUDO_DEFAULT_UNIT: Record<string, string> = {
  translateX: "px",
  translateY: "px",
  translateZ: "px",
  scale: "",
  scaleX: "",
  scaleY: "",
  scaleZ: "",
  rotate: "deg",
  rotateX: "deg",
  rotateY: "deg",
  rotateZ: "deg",
  skew: "deg",
  skewX: "deg",
  skewY: "deg",
}

/**
 * Canonical order for composing transform functions. Mirrors GSAP /
 * Motion: translate, rotate, scale, skew. Predictable ordering means
 * two animations on the same element compose without surprise.
 */
const TRANSFORM_ORDER: readonly string[] = [
  "translateX",
  "translateY",
  "translateZ",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "scale",
  "scaleX",
  "scaleY",
  "scaleZ",
  "skew",
  "skewX",
  "skewY",
]

function formatPseudo(fn: string, value: PropertyValue): string {
  if (typeof value === "string") return `${fn}(${value})`
  const unit = PSEUDO_DEFAULT_UNIT[fn] ?? ""
  return `${fn}(${value}${unit})`
}

function composeTransform(parts: Record<string, PropertyValue>): string {
  const out: string[] = []
  for (const fn of TRANSFORM_ORDER) {
    if (fn in parts) {
      const value = parts[fn]
      if (value !== undefined) out.push(formatPseudo(fn, value))
    }
  }
  return out.join(" ")
}

export function applyValues(
  el: ElementShim,
  values: Readonly<Record<string, PropertyValue>>,
): void {
  // Defer allocating the transform-parts bag until we see the first
  // pseudo key. Most per-frame applies have no pseudo props at all
  // (opacity-only, width-only, etc.) and paid for an empty object.
  let transformParts: Record<string, PropertyValue> | null = null
  let explicitTransform: string | null = null

  for (const key in values) {
    const value = values[key]
    if (value === undefined) continue
    if (key === "transform" && typeof value === "string") {
      explicitTransform = value
      continue
    }
    const info = classify(key)
    if (info.apply === "transform") {
      const fn = pseudoToTransformFn(key)
      if (fn) {
        if (transformParts === null) transformParts = {}
        transformParts[fn] = value
      }
      continue
    }
    const rendered = typeof value === "number" ? String(value) : value
    if (info.apply === "attr") {
      el.setAttribute(info.target, rendered)
    } else {
      el.style.setProperty(info.target, rendered)
    }
  }

  if (transformParts !== null) {
    el.style.setProperty("transform", composeTransform(transformParts))
  } else if (explicitTransform !== null) {
    el.style.setProperty("transform", explicitTransform)
  }
}
