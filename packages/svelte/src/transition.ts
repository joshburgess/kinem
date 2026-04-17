/**
 * `motifTransition` is a Svelte custom transition function compatible
 * with the `transition:`, `in:`, and `out:` directives. It interpolates
 * between `from` and `to` using motif's interpolation registry, so the
 * same color/unit/transform parsing used by `tween()` applies here.
 *
 *   <div transition:motifTransition={{ from: { opacity: 0 }, to: { opacity: 1 },
 *                                      duration: 300 }} />
 *
 * Svelte runs the returned `tick(t, u)` on every frame during the
 * transition (`t` grows from 0→1 on enter and shrinks from 1→0 on
 * leave). We apply the interpolated values directly to the element's
 * inline style.
 */

import { type EasingFn, easeOut, interpolate } from "motif-animate"

export type MotifTransitionValues = Readonly<Record<string, string | number>>

export interface MotifTransitionOpts {
  readonly from: MotifTransitionValues
  readonly to: MotifTransitionValues
  readonly duration?: number
  readonly delay?: number
  readonly easing?: EasingFn
}

export type MotifTransitionFn = (node: Element, opts: MotifTransitionOpts) => SvelteTransitionConfig

interface SvelteTransitionConfig {
  delay?: number
  duration?: number
  easing?: (t: number) => number
  tick?: (t: number, u: number) => void
}

export const motifTransition: MotifTransitionFn = (node, opts) => {
  const style = (node as HTMLElement).style
  const samplers: Array<{ key: string; sample: (p: number) => string | number }> = []
  for (const key of Object.keys(opts.to)) {
    const fromVal = opts.from[key]
    const toVal = opts.to[key]
    if (fromVal === undefined || toVal === undefined) continue
    samplers.push({ key, sample: interpolate(fromVal, toVal) })
  }

  return {
    delay: opts.delay ?? 0,
    duration: opts.duration ?? 400,
    easing: opts.easing ?? easeOut,
    tick: (t) => {
      if (!style) return
      for (const { key, sample } of samplers) {
        const v = sample(t)
        style.setProperty(key, typeof v === "number" ? String(v) : v)
      }
    },
  }
}
