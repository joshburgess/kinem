import { type SpringOpts, springEasing } from "../core/easing"
import type { AnimationDef } from "../core/types"
import { type TweenProps, type TweenValue, tween } from "./tween"

/**
 * Physics-based animation constructor. Duration is derived from the spring
 * simulation (time to settle within the rest thresholds), not supplied by
 * the caller.
 *
 * ```ts
 * spring({ x: [0, 100] }, { stiffness: 200, damping: 15, mass: 1 })
 * ```
 */
export function spring<P extends TweenProps>(
  props: P,
  opts: SpringOpts = {},
): AnimationDef<TweenValue<P>> {
  const easing = springEasing(opts)
  return tween(props, { easing, duration: easing.duration })
}
