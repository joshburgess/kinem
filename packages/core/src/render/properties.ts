/**
 * Classify an animatable property into a rendering tier.
 *
 *  - `compositor`: handled off the main thread via WAAPI when available.
 *     `transform`, `opacity`, `filter`, `clip-path`, `background-color`
 *     (the latter accelerated on recent Blink/WebKit).
 *  - `main`: requires main-thread work. Geometry, box model, SVG
 *     attributes, custom properties, and anything unknown.
 *  - `pseudo`: motion-style shorthand (x, y, scale, rotate) that resolves
 *     to `transform` before being applied. Compositor-safe.
 */

export type PropertyTier = "compositor" | "main" | "pseudo"

export interface PropertyInfo {
  readonly tier: PropertyTier
  /**
   * Target attribute when writing to the DOM. For CSS, this is the
   * kebab-case CSS property; for SVG, the attribute name. Pseudo props
   * resolve to `transform`.
   */
  readonly target: string
  /**
   * How the value is applied by the rAF backend:
   *   - `style`: `element.style[camelCase] = value`
   *   - `attr`:  `element.setAttribute(target, value)` (SVG)
   *   - `transform`: composed into the shared transform string
   */
  readonly apply: "style" | "attr" | "transform"
}

const COMPOSITOR_STYLE = new Set<string>([
  "opacity",
  "transform",
  "filter",
  "backdropFilter",
  "clipPath",
  "backgroundColor",
])

const PSEUDO_TO_TRANSFORM: Record<string, string> = {
  x: "translateX",
  y: "translateY",
  z: "translateZ",
  translateX: "translateX",
  translateY: "translateY",
  translateZ: "translateZ",
  scale: "scale",
  scaleX: "scaleX",
  scaleY: "scaleY",
  scaleZ: "scaleZ",
  rotate: "rotate",
  rotateX: "rotateX",
  rotateY: "rotateY",
  rotateZ: "rotateZ",
  skew: "skew",
  skewX: "skewX",
  skewY: "skewY",
}

const SVG_ATTRS = new Set<string>([
  "d",
  "points",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x1",
  "y1",
  "x2",
  "y2",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeDasharray",
  "strokeDashoffset",
  "viewBox",
  "pathLength",
])

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function classify(property: string): PropertyInfo {
  if (property in PSEUDO_TO_TRANSFORM) {
    return { tier: "pseudo", target: "transform", apply: "transform" }
  }
  if (property === "transform" || COMPOSITOR_STYLE.has(property)) {
    return { tier: "compositor", target: toKebab(property), apply: "style" }
  }
  if (SVG_ATTRS.has(property)) {
    // Normalize camelCase SVG attrs to kebab-case where applicable.
    const target = property === "viewBox" ? "viewBox" : toKebab(property)
    return { tier: "main", target, apply: "attr" }
  }
  return { tier: "main", target: toKebab(property), apply: "style" }
}

export function isCompositorSafe(property: string): boolean {
  const info = classify(property)
  return info.tier === "compositor" || info.tier === "pseudo"
}

/**
 * Resolve a pseudo transform prop to the transform-function name that
 * should be emitted. Returns `null` for non-pseudo props.
 */
export function pseudoToTransformFn(property: string): string | null {
  return PSEUDO_TO_TRANSFORM[property] ?? null
}

/**
 * Partition a list of property names by tier. Pseudo props are folded
 * into the compositor set (they resolve to transform).
 */
export function partitionByTier(props: readonly string[]): {
  readonly compositor: readonly string[]
  readonly main: readonly string[]
} {
  const compositor: string[] = []
  const main: string[] = []
  for (const p of props) {
    const { tier } = classify(p)
    if (tier === "main") main.push(p)
    else compositor.push(p)
  }
  return { compositor, main }
}
