/**
 * `useLayout` animates an element between layout positions using FLIP
 * (First, Last, Invert, Play).
 *
 *   const { ref } = useLayout({ duration: 300 })
 *   return <div ref={ref}>{items}</div>
 *
 * The hook captures the element's bounding rect on every layout pass.
 * When the position or size changes, it inverts the delta immediately
 * via a transform (so the element paints at its old location) and then
 * animates the transform back to identity.
 *
 * Requires `HTMLElement` targets. Happy-dom provides
 * `getBoundingClientRect` with zeros, so the hook becomes a no-op in
 * that environment. The effect runs on every commit, so no explicit
 * `dependency` argument is required.
 */

import {
  type Controls,
  type EasingFn,
  type LayoutGroup,
  type PlayOpts,
  type SpringOpts,
  type StrategyTarget,
  defaultLayoutGroup,
  omitUndefined,
  play,
  springEasing,
  tween,
} from "@kinem/core"
import { useEffect, useLayoutEffect, useMemo, useRef } from "react"

export interface UseLayoutOpts {
  /** Tween duration in ms. Default 300. Ignored when `spring` is set. */
  readonly duration?: number
  readonly easing?: EasingFn
  /**
   * Use spring physics instead of a fixed-duration tween. The spring's
   * settling time becomes the animation duration, and `duration` /
   * `easing` are ignored.
   */
  readonly spring?: SpringOpts
  readonly backend?: PlayOpts["backend"]
  /**
   * Whether to animate scale as well as position. Default true. Set to
   * false if only positional FLIP is desired (useful for elements whose
   * size shouldn't visually stretch during re-layout).
   */
  readonly animateScale?: boolean
  /**
   * Shared-element layout id. When set, the hook consumes any rect
   * captured under this id from `layoutGroup` on mount and uses it as
   * the FLIP "previous" rect (so the element animates from the old
   * element's position). On unmount the hook captures its current rect
   * under the same id so a subsequent mount can pick it up.
   */
  readonly layoutId?: string
  /**
   * Registry to use for shared-element captures. Defaults to the
   * process-wide `defaultLayoutGroup`.
   */
  readonly layoutGroup?: LayoutGroup
}

export interface UseLayoutResult<T extends HTMLElement = HTMLElement> {
  readonly ref: (el: T | null) => void
}

interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

function rectsDiffer(a: Rect, b: Rect): boolean {
  return a.left !== b.left || a.top !== b.top || a.width !== b.width || a.height !== b.height
}

export function useLayout<T extends HTMLElement = HTMLElement>(
  opts: UseLayoutOpts = {},
): UseLayoutResult<T> {
  const elRef = useRef<T | null>(null)
  const prevRectRef = useRef<Rect | null>(null)
  const controlsRef = useRef<Controls | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const result = useMemo<UseLayoutResult<T>>(
    () => ({
      ref(el) {
        elRef.current = el
      },
    }),
    [],
  )

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    const next = readRect(el)
    const currentOpts0 = optsRef.current
    const group = currentOpts0.layoutGroup ?? defaultLayoutGroup
    // On first measurement, see if a shared-element rect was captured
    // for our layoutId; if so, treat that as the previous rect.
    let prev = prevRectRef.current
    if (!prev && currentOpts0.layoutId) {
      const snap = group.consume(currentOpts0.layoutId)
      if (snap) prev = snap.rect
    }
    prevRectRef.current = next
    if (!prev) return
    if (!rectsDiffer(prev, next)) return
    if (next.width === 0 || next.height === 0) return

    const dx = prev.left - next.left
    const dy = prev.top - next.top
    const sx = prev.width / next.width
    const sy = prev.height / next.height
    const animateScale = optsRef.current.animateScale !== false

    const tweenProps: Record<string, readonly [number, number]> = {
      x: [dx, 0],
      y: [dy, 0],
    }
    if (animateScale) {
      tweenProps["scaleX"] = [sx, 1]
      tweenProps["scaleY"] = [sy, 1]
    }

    const existing = controlsRef.current
    if (existing && existing.state !== "cancelled" && existing.state !== "finished") {
      existing.cancel()
    }

    const currentOpts = currentOpts0
    const spring = currentOpts.spring ? springEasing(currentOpts.spring) : null
    const def = tween(tweenProps, {
      duration: spring ? spring.duration : (currentOpts.duration ?? 300),
      ...omitUndefined({ easing: spring ?? currentOpts.easing }),
    })
    const playOpts: PlayOpts = omitUndefined({ backend: currentOpts.backend })
    controlsRef.current = play(def, [el as unknown as StrategyTarget], playOpts)
  })

  useEffect(() => {
    return () => {
      const c = controlsRef.current
      if (c && c.state !== "cancelled" && c.state !== "finished") c.cancel()
      controlsRef.current = null
      // Capture our last rect under layoutId so a sibling that mounts
      // with the same id can animate from where we were.
      const opts = optsRef.current
      if (opts.layoutId) {
        const last = prevRectRef.current
        if (last && last.width > 0 && last.height > 0) {
          const group = opts.layoutGroup ?? defaultLayoutGroup
          group.capture(opts.layoutId, last)
        }
      }
    }
  }, [])

  return result
}
