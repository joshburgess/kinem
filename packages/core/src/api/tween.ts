import { getCssEasing, isSpringEasing, linear } from "../core/easing"
import type { AnimationDef, CommitTarget, EasingFn } from "../core/types"
import { interpolate } from "../interpolate/registry"
import { classify, partitionByTier, pseudoToTransformFn } from "../render/properties"

const clamp01 = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p)

/**
 * Widen literal types to their base type so that `[0, 100]` produces a
 * `number` value (not `0 | 100`). This lets tween animations compose in
 * `sequence`/`parallel` even when their from/to literals differ.
 */
type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T

export type TweenProps = Record<string, readonly unknown[]>

/**
 * The value type of a tween animation: for each property, the widened
 * element type of its `[from, to]` pair.
 */
export type TweenValue<P extends TweenProps> = {
  [K in keyof P]: P[K] extends readonly (infer V)[] ? Widen<V> : never
}

export interface TweenOpts {
  /**
   * Animation duration in ms. If omitted and `easing` carries its own
   * duration (a spring easing), that duration is used. Otherwise defaults
   * to 400ms.
   */
  readonly duration?: number
  readonly easing?: EasingFn
}

const DEFAULT_DURATION = 400

// Default unit appended when a pseudo transform prop is given as a
// plain number. Kept in sync with apply.ts::PSEUDO_DEFAULT_UNIT.
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

// Canonical order for composing transform functions. Must match
// apply.ts::TRANSFORM_ORDER so that the direct-commit path produces
// byte-identical output to the applyValues path.
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
const TRANSFORM_RANK: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  for (let i = 0; i < TRANSFORM_ORDER.length; i++) m[TRANSFORM_ORDER[i] as string] = i
  return m
})()

type Interp = (p: number) => unknown

interface StyleOp {
  readonly target: string
  readonly interp: Interp
}
interface AttrOp {
  readonly target: string
  readonly interp: Interp
}
interface TransformOp {
  readonly fn: string
  readonly unit: string
  readonly interp: Interp
}

interface CommitPlan {
  readonly styleOps: readonly StyleOp[]
  readonly attrOps: readonly AttrOp[]
  readonly transformOps: readonly TransformOp[]
  // An explicit `transform: [a, b]` pair (string-valued) takes over the
  // whole transform slot when there are no pseudo ops.
  readonly explicitTransform: Interp | null
}

function buildCommitPlan(
  keys: readonly string[],
  perPropFns: readonly Interp[],
): CommitPlan {
  const styleOps: StyleOp[] = []
  const attrOps: AttrOp[] = []
  const transformOps: TransformOp[] = []
  let explicitTransform: Interp | null = null

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string
    const interp = perPropFns[i] as Interp
    if (key === "transform") {
      explicitTransform = interp
      continue
    }
    const info = classify(key)
    if (info.apply === "transform") {
      const fn = pseudoToTransformFn(key)
      if (fn) {
        transformOps.push({ fn, unit: PSEUDO_DEFAULT_UNIT[fn] ?? "", interp })
      }
    } else if (info.apply === "attr") {
      attrOps.push({ target: info.target, interp })
    } else {
      styleOps.push({ target: info.target, interp })
    }
  }

  transformOps.sort((a, b) => (TRANSFORM_RANK[a.fn] ?? 0) - (TRANSFORM_RANK[b.fn] ?? 0))

  return { styleOps, attrOps, transformOps, explicitTransform }
}

function renderValue(v: unknown): string {
  return typeof v === "number" ? String(v) : (v as string)
}

function commitWithPlan(
  plan: CommitPlan,
  easing: EasingFn,
  p: number,
  el: CommitTarget,
): void {
  const eased = easing(clamp01(p))
  const { styleOps, attrOps, transformOps, explicitTransform } = plan

  for (let i = 0; i < styleOps.length; i++) {
    const op = styleOps[i] as StyleOp
    el.style.setProperty(op.target, renderValue(op.interp(eased)))
  }
  for (let i = 0; i < attrOps.length; i++) {
    const op = attrOps[i] as AttrOp
    el.setAttribute(op.target, renderValue(op.interp(eased)))
  }
  if (transformOps.length > 0) {
    let s = ""
    for (let i = 0; i < transformOps.length; i++) {
      const op = transformOps[i] as TransformOp
      const v = op.interp(eased)
      if (i > 0) s += " "
      if (typeof v === "string") {
        s += `${op.fn}(${v})`
      } else {
        s += `${op.fn}(${v}${op.unit})`
      }
    }
    el.style.setProperty("transform", s)
  } else if (explicitTransform !== null) {
    el.style.setProperty("transform", renderValue(explicitTransform(eased)))
  }
}

/**
 * Construct a multi-property tween. Each entry in `props` is a
 * `[from, to]` tuple; the interpolation registry selects the right
 * interpolator per property.
 *
 * ```ts
 * tween({ opacity: [0, 1], x: [0, 100] }, { duration: 500, easing: easeOut })
 * ```
 */
export function tween<P extends TweenProps>(
  props: P,
  opts: TweenOpts = {},
): AnimationDef<TweenValue<P>> {
  const easing = opts.easing ?? linear
  const duration = opts.duration ?? (isSpringEasing(easing) ? easing.duration : DEFAULT_DURATION)

  const keys = Object.keys(props) as Array<keyof P & string>
  const perPropFns: Array<(p: number) => unknown> = new Array(keys.length)
  let allPlainNumbers = true
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string
    const pair = props[key] as readonly unknown[]
    if (pair.length !== 2) {
      throw new Error(
        `tween(): property "${key}" must be a [from, to] pair (got length ${pair.length}); use keyframes() for more than two stops`,
      )
    }
    perPropFns[i] = interpolate(pair[0], pair[1])
    if (typeof pair[0] !== "number" || typeof pair[1] !== "number") {
      allPlainNumbers = false
    }
  }

  const properties = keys as readonly string[]
  const tierSplit = partitionByTier(properties)
  const linearizable = allPlainNumbers && getCssEasing(easing) !== undefined

  // Pre-classified commit plan. The rAF backend uses this to write
  // property values directly to the element, skipping the intermediate
  // `Record<string, unknown>` allocation and the per-frame `classify()`
  // loop in `applyValues`.
  const plan = buildCommitPlan(keys, perPropFns)
  const commit = (p: number, el: CommitTarget): void => {
    commitWithPlan(plan, easing, p, el)
  }

  return {
    duration,
    easing,
    interpolate: (p) => {
      const eased = easing(clamp01(p))
      const out: Record<string, unknown> = {}
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as string
        out[key] = (perPropFns[i] as (q: number) => unknown)(eased)
      }
      return out as TweenValue<P>
    },
    properties,
    tierSplit,
    linearizable,
    commit,
  }
}
