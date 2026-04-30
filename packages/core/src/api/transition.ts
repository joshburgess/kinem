/**
 * Motion-component-shaped `MotionTransition` is a Framer-style shorthand
 * for a tween or spring. This helper resolves it into the concrete
 * `{ duration, easing }` pair that `tween()` consumes.
 *
 *  type "tween" (default): { duration: ms, easing: EasingFn }
 *  type "spring": springEasing({ stiffness, damping, mass, velocity })
 *                 with `.duration` taken from the spring's settling
 *                 time unless the caller overrode it explicitly.
 *
 * Lives in core so all four adapters resolve identically. No DOM here:
 * adapters provide the values bag and the play backend separately.
 */

import { type SpringOpts, springEasing } from "../core/easing"
import type { EasingFn } from "../core/types"

export type TransitionType = "tween" | "spring"

export interface MotionTransitionShape extends SpringOpts {
  readonly type?: TransitionType
  readonly duration?: number
  readonly easing?: EasingFn
}

export interface ResolvedTransition {
  readonly duration: number
  readonly easing?: EasingFn
}

const DEFAULT_TWEEN_DURATION_MS = 400

export function resolveTransition(t: MotionTransitionShape | undefined): ResolvedTransition {
  if (!t || t.type === "tween" || (!t.type && t.duration !== undefined && !hasSpringFields(t))) {
    return resolveTween(t)
  }
  if (t.type === "spring" || hasSpringFields(t)) {
    return resolveSpring(t)
  }
  return resolveTween(t)
}

const hasSpringFields = (t: MotionTransitionShape): boolean =>
  t.stiffness !== undefined ||
  t.damping !== undefined ||
  t.mass !== undefined ||
  t.velocity !== undefined ||
  t.restVelocity !== undefined ||
  t.restDisplacement !== undefined

const resolveTween = (t: MotionTransitionShape | undefined): ResolvedTransition => {
  const out: { duration: number; easing?: EasingFn } = {
    duration: t?.duration ?? DEFAULT_TWEEN_DURATION_MS,
  }
  if (t?.easing) out.easing = t.easing
  return out
}

const resolveSpring = (t: MotionTransitionShape): ResolvedTransition => {
  const springOpts: { -readonly [K in keyof SpringOpts]: SpringOpts[K] } = {}
  if (t.stiffness !== undefined) springOpts.stiffness = t.stiffness
  if (t.damping !== undefined) springOpts.damping = t.damping
  if (t.mass !== undefined) springOpts.mass = t.mass
  if (t.velocity !== undefined) springOpts.velocity = t.velocity
  if (t.restVelocity !== undefined) springOpts.restVelocity = t.restVelocity
  if (t.restDisplacement !== undefined) springOpts.restDisplacement = t.restDisplacement
  const easing = springEasing(springOpts)
  return {
    duration: t.duration ?? easing.duration,
    easing,
  }
}
