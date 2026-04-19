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
  type PlayOpts,
  type StrategyTarget,
  play,
  tween,
} from "@kinem/core"
import { useEffect, useLayoutEffect, useMemo, useRef } from "react"

export interface UseLayoutOpts {
  /** Tween duration in ms. Default 300. */
  readonly duration?: number
  readonly easing?: EasingFn
  readonly backend?: PlayOpts["backend"]
  /**
   * Whether to animate scale as well as position. Default true. Set to
   * false if only positional FLIP is desired (useful for elements whose
   * size shouldn't visually stretch during re-layout).
   */
  readonly animateScale?: boolean
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
    const prev = prevRectRef.current
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

    const currentOpts = optsRef.current
    const def = tween(tweenProps, {
      duration: currentOpts.duration ?? 300,
      ...(currentOpts.easing !== undefined ? { easing: currentOpts.easing } : {}),
    })
    const playOpts: PlayOpts = {}
    if (currentOpts.backend !== undefined) {
      ;(playOpts as { backend?: PlayOpts["backend"] }).backend = currentOpts.backend
    }
    controlsRef.current = play(def, [el as unknown as StrategyTarget], playOpts)
  })

  useEffect(() => {
    return () => {
      const c = controlsRef.current
      if (c && c.state !== "cancelled" && c.state !== "finished") c.cancel()
      controlsRef.current = null
    }
  }, [])

  return result
}
