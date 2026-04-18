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

/**
 * The core animation description. An AnimationDef is a pure value: it carries
 * all the information needed to evaluate the animation at any point in time,
 * but does not touch the DOM or start any timer.
 *
 * `interpolate` receives progress in [0, 1]. Combinators compose new
 * AnimationDefs by building new interpolate functions that dispatch to their
 * children.
 */
export interface AnimationDef<T> {
  readonly interpolate: Interpolator<T>
  readonly duration: number
  readonly easing: EasingFn
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

export interface LoopOpts {
  readonly count?: number
  readonly yoyo?: boolean
}
