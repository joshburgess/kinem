/**
 * `useMotifTransition` bridges motif's `play()` engine to Vue's built-in
 * `<Transition>` / `<TransitionGroup>` JavaScript hooks. It does not
 * reinvent presence tracking; Vue decides when an element enters or
 * leaves, and motif drives the actual animation.
 *
 *   const t = useMotifTransition({
 *     enter: { from: { opacity: 0 }, to: { opacity: 1 }, duration: 300 },
 *     leave: { from: { opacity: 1 }, to: { opacity: 0 }, duration: 200 },
 *   })
 *
 *   <Transition :css="false" v-bind="t">
 *     <div v-if="show">...</div>
 *   </Transition>
 *
 * Returns an object of listener props (`onBeforeEnter`, `onEnter`,
 * `onLeave`, `onEnterCancelled`, `onLeaveCancelled`). Pair with
 * `:css="false"` to disable Vue's CSS-class transition path; motif
 * owns the frames.
 */

import type { Controls, EasingFn, PlayOpts, StrategyTarget } from "motif-animate"
import { play, tween } from "motif-animate"

export type TransitionValues = Readonly<Record<string, string | number>>

export interface MotifTransitionPhase {
  readonly from: TransitionValues
  readonly to: TransitionValues
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
}

export interface UseMotifTransitionOpts {
  readonly enter?: MotifTransitionPhase
  readonly leave?: MotifTransitionPhase
}

export interface MotifTransitionHooks {
  onBeforeEnter(el: Element): void
  onEnter(el: Element, done: () => void): void
  onLeave(el: Element, done: () => void): void
  onEnterCancelled(el: Element): void
  onLeaveCancelled(el: Element): void
}

function applyInline(el: Element, values: TransitionValues): void {
  const style = (el as HTMLElement).style
  if (!style) return
  for (const key of Object.keys(values)) {
    const v = values[key]
    if (v === undefined) continue
    style.setProperty(key, typeof v === "number" ? String(v) : v)
  }
}

function buildTweenProps(
  from: TransitionValues,
  to: TransitionValues,
): Record<string, readonly [string | number, string | number]> {
  const props: Record<string, readonly [string | number, string | number]> = {}
  for (const key of Object.keys(to)) {
    const fromVal = from[key] ?? to[key]
    const toVal = to[key]
    if (fromVal === undefined || toVal === undefined) continue
    props[key] = [fromVal, toVal]
  }
  return props
}

function runPhase(el: Element, phase: MotifTransitionPhase, done: () => void): Controls | null {
  const tweenProps = buildTweenProps(phase.from, phase.to)
  if (Object.keys(tweenProps).length === 0) {
    done()
    return null
  }
  const def = tween(tweenProps, {
    duration: phase.duration ?? 400,
    ...(phase.easing !== undefined ? { easing: phase.easing } : {}),
  })
  const playOpts: PlayOpts = {}
  if (phase.backend !== undefined) {
    ;(playOpts as { backend?: PlayOpts["backend"] }).backend = phase.backend
  }
  const controls = play(def, [el as unknown as StrategyTarget], playOpts)
  controls.finished.then(done, done)
  return controls
}

export function useMotifTransition(opts: UseMotifTransitionOpts): MotifTransitionHooks {
  const active = new WeakMap<Element, Controls>()

  const cancelFor = (el: Element): void => {
    const c = active.get(el)
    if (!c) return
    if (c.state !== "cancelled" && c.state !== "finished") c.cancel()
    active.delete(el)
  }

  return {
    onBeforeEnter(el) {
      if (opts.enter) applyInline(el, opts.enter.from)
    },
    onEnter(el, done) {
      cancelFor(el)
      if (!opts.enter) {
        done()
        return
      }
      const c = runPhase(el, opts.enter, () => {
        active.delete(el)
        done()
      })
      if (c) active.set(el, c)
    },
    onLeave(el, done) {
      cancelFor(el)
      if (!opts.leave) {
        done()
        return
      }
      const c = runPhase(el, opts.leave, () => {
        active.delete(el)
        done()
      })
      if (c) active.set(el, c)
    },
    onEnterCancelled(el) {
      cancelFor(el)
    },
    onLeaveCancelled(el) {
      cancelFor(el)
    },
  }
}
