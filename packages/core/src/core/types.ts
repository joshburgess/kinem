/**
 * Minimal DOM-like shim used by `commit(p, el)`. Declared here rather
 * than re-imported from the render layer so the type graph stays
 * acyclic.
 */
export interface CommitStyle {
  setProperty(name: string, value: string): void
}
export interface CommitTarget {
  readonly style: CommitStyle
  setAttribute(name: string, value: string): void
}

/**
 * An Interpolator is a pure function from normalized progress [0, 1] to a value.
 * Progress values outside [0, 1] are valid for extrapolation scenarios but
 * most combinators clamp before invoking.
 */
export type Interpolator<T> = (progress: number) => T

/**
 * An EasingFn warps linear progress [0, 1] into eased progress [0, 1]
 * (though values may overshoot, e.g. spring easings).
 */
export type EasingFn = (progress: number) => number

declare const SPRING_EASING_BRAND: unique symbol

/**
 * A spring easing carries its computed settling duration alongside the
 * easing function. The unique-symbol brand distinguishes it from any
 * `EasingFn` that happens to expose a `duration` property by accident,
 * so `isSpringEasing()` is safe even when a caller wraps another
 * easing.
 */
export type SpringEasingFn = EasingFn & {
  readonly duration: number
  readonly [SPRING_EASING_BRAND]: true
}

declare const NORMALIZED_VELOCITY_BRAND: unique symbol

/**
 * A spring `velocity` value, expressed in normalized units of travel per
 * second (NOT real-world rad/s, m/s, etc.). For a spring whose
 * displacement spans `D` units (e.g. 100 px or 1 rad), a real-world
 * velocity of `v` is converted by `v / D`. Use `normalizedVelocity()`
 * to mint one from a number you've already converted, or
 * `velocityFromSpan(realVelocity, span)` to do the conversion at the
 * call site.
 */
export type NormalizedVelocity = number & {
  readonly [NORMALIZED_VELOCITY_BRAND]: true
}

/**
 * Tag identifying which constructor produced an `AnimationDef`. Set by
 * every built-in constructor; useful for devtools, debugging, and
 * exhaustive switches in user code that branch on def kind. Custom defs
 * (e.g. produced by `animation()` from a raw interpolator) can pass any
 * string; the canonical built-in tags are listed here.
 */
export type AnimationKind =
  | "tween"
  | "spring"
  | "keyframes"
  | "bezier"
  | "catmull-rom"
  | "motion-path"
  | "arc"
  | "morph-path"
  | "sequence"
  | "parallel"
  | "stagger"
  | "loop"
  | "delay"
  | "reverse"
  | "map"
  | "raw"

/**
 * The core animation description. An AnimationDef is a pure value: it carries
 * all the information needed to evaluate the animation at any point in time,
 * but does not touch the DOM or start any timer.
 *
 * `interpolate` receives progress in [0, 1]. Combinators compose new
 * AnimationDefs by building new interpolate functions that dispatch to their
 * children.
 *
 * `easing` is optional: when omitted, consumers treat it as the identity
 * (`linear`). Most defs that want easing already bake it into `interpolate`,
 * so this field is only meaningful at the boundaries that re-sample easing
 * separately (the WAAPI keyframe path and the worker bridge).
 *
 * `kind` is set by every built-in constructor (`tween`, `spring`, `parallel`,
 * etc.) so devtools and consumer code can branch on def shape without
 * sniffing for properties. Optional so legacy/custom defs keep working.
 */
export interface AnimationDef<T> {
  readonly interpolate: Interpolator<T>
  readonly duration: number
  readonly easing?: EasingFn | SpringEasingFn
  readonly kind?: AnimationKind | (string & {})
  /**
   * Set by leaf constructors that produce an animation whose values at
   * every progress point match `valueAtZero + easing(p) * (valueAtOne - valueAtZero)`
   * componentwise, under browser-native linear interpolation of each
   * property. When true, the WAAPI backend may emit a 2-keyframe
   * animation with `easing` as the CSS timing function, bypassing dense
   * sampling. Safe for plain numeric properties with CSS-tagged easings.
   *
   * @internal
   */
  readonly linearizable?: boolean
  /**
   * Optional cache of the property keys produced by `interpolate`. When
   * set, the strategy router uses this directly instead of sampling the
   * animation at t=0 and t=1 to discover keys. Leaf constructors that
   * know their output shape (`tween`, `keyframes`) populate this;
   * combinators that preserve shape propagate it; combinators that may
   * change shape (`map`, `parallel`, `stagger`) leave it unset so the
   * router falls back to sampling.
   *
   * @internal
   */
  readonly properties?: readonly string[]
  /**
   * Optional pre-computed tier partition. Leaf constructors classify
   * properties once at construction time and stash the result here so
   * the strategy router can skip `discoverProperties` +
   * `partitionByTier` on first play. Parallels `properties` in spirit:
   * trades a small constructor-time cost for zero first-play work on
   * unique-def workloads (where the WeakMap tier cache misses). When
   * all properties fall into one tier, the other array is a shared
   * frozen empty reference to avoid per-def allocation.
   *
   * @internal
   */
  readonly tierSplit?: {
    readonly props: readonly string[]
    readonly compositor: readonly string[]
    readonly main: readonly string[]
  }
  /**
   * Optional direct-commit path. When present, the rAF backend calls
   * `commit(p, el)` per target per frame instead of `interpolate(p)` +
   * `applyValues(el, values)`. Leaf defs that know their full property
   * plan at construction time (currently `tween`) implement this to
   * skip the intermediate `Record<string, unknown>` allocation and the
   * per-frame `classify` + branch loop in `applyValues`. Callers that
   * need raw values (stagger, non-DOM surfaces) use `interpolate` as
   * before.
   *
   * @internal
   */
  readonly commit?: (p: number, el: CommitTarget) => void
  /**
   * Marks the def as producing a length-N tuple of per-element values
   * (one per target). When `play()` sees this, it samples the def once
   * per frame and dispatches `value[i]` to `target[i]`, instead of
   * trying to read property names off the array itself. Set by
   * `stagger()`. The number is the element count baked into the def.
   *
   * Fan-out defs cannot be tier-split for compositor routing because
   * each target gets a different value at any given time; they always
   * run on the rAF backend.
   *
   * @internal
   */
  readonly fanOut?: number
}

/** Extract the value type from an AnimationDef. */
export type ValueOf<A> = A extends AnimationDef<infer T> ? T : never

/**
 * Tuple of values produced by `parallel(...)` over heterogeneous AnimationDefs.
 * `parallel(AnimationDef<number>, AnimationDef<string>)` produces
 * `AnimationDef<readonly [number, string]>`.
 */
export type ParallelValues<T extends readonly AnimationDef<unknown>[]> = {
  readonly [K in keyof T]: T[K] extends AnimationDef<infer U> ? U : never
}

/**
 * Custom stagger-order strategy. Given a zero-based index and the total
 * count, returns an "order index" that is multiplied by `each` to
 * produce the per-element delay. The returned value need not be an
 * integer, nor monotonic in `i`.
 */
export type StaggerFn = (index: number, count: number) => number

export type StaggerFrom = "start" | "end" | "center" | "edges" | number | StaggerFn

export interface StaggerOpts {
  readonly each: number
  readonly count: number
  readonly from?: StaggerFrom
}

/**
 * Options for the array form of `stagger()`. `count` is inferred from
 * the array length, so it is omitted here.
 */
export interface StaggerArrayOpts {
  readonly each: number
  readonly from?: StaggerFrom
}

export interface LoopOpts {
  readonly count?: number
  readonly yoyo?: boolean
}
