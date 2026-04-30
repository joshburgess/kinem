/**
 * `useAnimate()` returns a `[scope, animate]` tuple for imperative
 * animation against elements inside a scoped subtree.
 *
 *   const [scope, animate] = useAnimate()
 *   const onClick = () => animate("li", { opacity: [0, 1] }, { duration: 300 })
 *   return <ul ref={scope}>{items.map(...)}</ul>
 *
 * `animate(target, props, opts)` resolves `target` (a CSS selector
 * string queried within `scope`, an `Element`, or an `Element[]`) and
 * runs a `tween()` of `props` against each match. Returns the
 * `Controls` from `play()`. If the scope is unattached or no targets
 * resolve, the call returns a settled controls handle.
 */

import {
  type Controls,
  type PlayOpts,
  type TweenOpts,
  type TweenProps,
  play,
  tween,
} from "@kinem/core"
import { useCallback, useMemo, useRef } from "react"

export type AnimateTarget = string | HTMLElement | readonly HTMLElement[]

export type UseAnimateAnimate = <P extends TweenProps>(
  target: AnimateTarget,
  props: P,
  opts?: TweenOpts & PlayOpts,
) => Controls

export type UseAnimateScope<T extends HTMLElement = HTMLElement> = (el: T | null) => void

export type UseAnimateResult<T extends HTMLElement = HTMLElement> = readonly [
  UseAnimateScope<T>,
  UseAnimateAnimate,
]

const resolveTargets = (scope: HTMLElement | null, target: AnimateTarget): HTMLElement[] => {
  if (typeof target === "string") {
    if (!scope) return []
    return Array.from(scope.querySelectorAll<HTMLElement>(target))
  }
  if (Array.isArray(target)) return target as HTMLElement[]
  return [target as HTMLElement]
}

export function useAnimate<T extends HTMLElement = HTMLElement>(): UseAnimateResult<T> {
  const current = useRef<T | null>(null)
  const scope = useMemo<UseAnimateScope<T>>(
    () => (el) => {
      current.current = el
    },
    [],
  )
  const animate = useCallback<UseAnimateAnimate>(
    <P extends TweenProps>(
      target: AnimateTarget,
      props: P,
      opts: TweenOpts & PlayOpts = {},
    ): Controls => {
      const targets = resolveTargets(current.current, target)
      return play(tween(props, opts) as Parameters<typeof play>[0], targets, opts)
    },
    [],
  )
  return [scope, animate] as const
}
