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

// `classify()` is called many times per play() (once per property via
// partitionByTier, and again per property per sample in toKeyframe()).
// Every call previously minted a fresh PropertyInfo object; at n=1000
// plays with 2-3 props each that's a measurable amount of GC pressure.
// Property names come from a very small alphabet in practice, so a
// module-level Map amortizes the classification cost across the process.
const classifyCache = new Map<string, PropertyInfo>()

function classifyUncached(property: string): PropertyInfo {
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

export function classify(property: string): PropertyInfo {
  const cached = classifyCache.get(property)
  if (cached !== undefined) return cached
  const info = classifyUncached(property)
  classifyCache.set(property, info)
  return info
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

// Shared empty reference reused whenever a partition has no props in
// one of the two tiers. At n=1000 unique-def plays that would otherwise
// be 1000 fresh `[]` allocations per side; the common tween workload
// (opacity/transform/x/y/scale only) falls into the all-compositor case.
const EMPTY: readonly string[] = Object.freeze([])

/**
 * Partition a list of property names by tier. Pseudo props are folded
 * into the compositor set (they resolve to transform). Only allocates
 * an array for a tier if at least one property belongs to it; the other
 * side is the shared `EMPTY` reference.
 *
 * Returns the input `props` reference alongside the partition so callers
 * (leaf defs) can stash the full triple as `tierSplit` without an extra
 * wrapper object per def.
 */
export function partitionByTier(props: readonly string[]): {
  readonly props: readonly string[]
  readonly compositor: readonly string[]
  readonly main: readonly string[]
} {
  let compositor: string[] | null = null
  let main: string[] | null = null
  for (const p of props) {
    if (classify(p).tier === "main") {
      if (main === null) main = []
      main.push(p)
    } else {
      if (compositor === null) compositor = []
      compositor.push(p)
    }
  }
  return { props, compositor: compositor ?? EMPTY, main: main ?? EMPTY }
}
