/**
 * `useAnimate()` returns `{ scope, animate }` for imperative animation
 * against elements inside a scoped subtree. `scope` is a Vue template
 * ref to bind via `:ref="scope"`; `animate(target, props, opts)`
 * resolves `target` (a CSS selector queried within scope, an Element,
 * or an Element[]) and runs a `tween()` of `props` against each match.
 *
 *   const { scope, animate } = useAnimate()
 *   const handleClick = () => animate("li", { opacity: [0, 1] }, { duration: 300 })
 *   <ul :ref="scope">...</ul>
 */

import {
  type Controls,
  type PlayOpts,
  type TweenOpts,
  type TweenProps,
  play,
  tween,
} from "@kinem/core"
import { type Ref, ref } from "vue"

export type AnimateTarget = string | HTMLElement | readonly HTMLElement[]

export type UseAnimateAnimate = <P extends TweenProps>(
  target: AnimateTarget,
  props: P,
  opts?: TweenOpts & PlayOpts,
) => Controls

export interface UseAnimateResult<T extends HTMLElement = HTMLElement> {
  readonly scope: Ref<T | null>
  readonly animate: UseAnimateAnimate
}

const resolveTargets = (scope: HTMLElement | null, target: AnimateTarget): HTMLElement[] => {
  if (typeof target === "string") {
    if (!scope) return []
    return Array.from(scope.querySelectorAll<HTMLElement>(target))
  }
  if (Array.isArray(target)) return target as HTMLElement[]
  return [target as HTMLElement]
}

export function useAnimate<T extends HTMLElement = HTMLElement>(): UseAnimateResult<T> {
  const scope = ref<T | null>(null) as Ref<T | null>
  const animate: UseAnimateAnimate = <P extends TweenProps>(
    target: AnimateTarget,
    props: P,
    opts: TweenOpts & PlayOpts = {},
  ): Controls => {
    const targets = resolveTargets(scope.value, target)
    return play(tween(props, opts) as Parameters<typeof play>[0], targets, opts)
  }
  return { scope, animate }
}
