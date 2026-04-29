/**
 * `createLayout` animates an element between layout positions using
 * FLIP (First, Last, Invert, Play). Solid parity for the React
 * `useLayout` hook and the Vue `useLayout` composable.
 *
 *   const layout = createLayout({ duration: 300 })
 *   <div ref={layout.ref}>{items()}</div>
 *
 * Captures the bound element's bounding rect on every commit. When
 * the position or size changes, it inverts the delta with a transform
 * (so the element paints at its old location) and animates the
 * transform back to identity. Per-frame state is driven by vanilla
 * `play()` from `@kinem/core`, not Solid signals.
 *
 * Solid runs effects after the DOM is committed, so re-measurement
 * happens when you call `layout.measure()` from inside an effect that
 * tracks whatever upstream signal drives the layout change.
 */

import {
  type Controls,
  type EasingFn,
  type PlayOpts,
  type StrategyTarget,
  play,
  tween,
} from "@kinem/core"
import { onCleanup, onMount } from "solid-js"

export interface CreateLayoutOpts {
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

export interface CreateLayoutResult<T extends HTMLElement = HTMLElement> {
  ref(el: T): void
  /**
   * Manually re-measure the element and animate the FLIP delta. Call
   * this from inside a `createEffect` that tracks the source of layout
   * changes, e.g. `createEffect(() => { items(); layout.measure() })`.
   */
  measure(): void
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

export function createLayout<T extends HTMLElement = HTMLElement>(
  opts: CreateLayoutOpts = {},
): CreateLayoutResult<T> {
  let el: T | null = null
  let prevRect: Rect | null = null
  let controls: Controls | null = null

  const measureAndPlay = (): void => {
    if (!el) return
    const next = readRect(el)
    const prev = prevRect
    prevRect = next
    if (!prev) return
    if (!rectsDiffer(prev, next)) return
    if (next.width === 0 || next.height === 0) return

    const dx = prev.left - next.left
    const dy = prev.top - next.top
    const sx = prev.width / next.width
    const sy = prev.height / next.height
    const animateScale = opts.animateScale !== false

    const tweenProps: Record<string, readonly [number, number]> = {
      x: [dx, 0],
      y: [dy, 0],
    }
    if (animateScale) {
      tweenProps["scaleX"] = [sx, 1]
      tweenProps["scaleY"] = [sy, 1]
    }

    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }

    const def = tween(tweenProps, {
      duration: opts.duration ?? 300,
      ...(opts.easing !== undefined ? { easing: opts.easing } : {}),
    })
    const playOpts: PlayOpts = {}
    if (opts.backend !== undefined) {
      ;(playOpts as { backend?: PlayOpts["backend"] }).backend = opts.backend
    }
    controls = play(def, [el as unknown as StrategyTarget], playOpts)
  }

  onMount(() => {
    if (el) prevRect = readRect(el)
  })

  onCleanup(() => {
    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }
    controls = null
    el = null
  })

  return {
    ref(node) {
      el = node
    },
    measure: measureAndPlay,
  }
}
