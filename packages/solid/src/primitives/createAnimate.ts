/**
 * `createAnimate()` returns `{ scope, animate }` for imperative
 * animation against elements inside a scoped subtree. `scope` is a
 * Solid ref setter (pass to `<div ref={scope}>`); `animate(target,
 * props, opts)` resolves `target` (CSS selector queried within scope,
 * an Element, or an Element[]) and runs a `tween()` of `props` against
 * each match.
 *
 *   const { scope, animate } = createAnimate()
 *   const onClick = () => animate("li", { opacity: [0, 1] }, { duration: 300 })
 *   return <ul ref={scope}>...</ul>
 */

import {
  type Controls,
  type PlayOpts,
  type TweenOpts,
  type TweenProps,
  play,
  tween,
} from "@kinem/core"

export type AnimateTarget = string | HTMLElement | readonly HTMLElement[]

export type CreateAnimateAnimate = <P extends TweenProps>(
  target: AnimateTarget,
  props: P,
  opts?: TweenOpts & PlayOpts,
) => Controls

export interface CreateAnimateResult<T extends HTMLElement = HTMLElement> {
  readonly scope: (el: T | null) => void
  readonly animate: CreateAnimateAnimate
}

const resolveTargets = (scope: HTMLElement | null, target: AnimateTarget): HTMLElement[] => {
  if (typeof target === "string") {
    if (!scope) return []
    return Array.from(scope.querySelectorAll<HTMLElement>(target))
  }
  if (Array.isArray(target)) return target as HTMLElement[]
  return [target as HTMLElement]
}

export function createAnimate<T extends HTMLElement = HTMLElement>(): CreateAnimateResult<T> {
  let current: T | null = null
  const scope = (el: T | null): void => {
    current = el
  }
  const animate: CreateAnimateAnimate = <P extends TweenProps>(
    target: AnimateTarget,
    props: P,
    opts: TweenOpts & PlayOpts = {},
  ): Controls => {
    const targets = resolveTargets(current, target)
    return play(tween(props, opts) as Parameters<typeof play>[0], targets, opts)
  }
  return { scope, animate }
}
