/**
 * `useLayout` animates an element between layout positions using FLIP
 * (First, Last, Invert, Play). Vue parity for the React `useLayout` hook.
 *
 *   const { ref } = useLayout({ duration: 300 })
 *   <div :ref="ref">{{ items }}</div>
 *
 * The composable captures the bound element's bounding rect on every
 * mount / update tick. When the position or size changes, it inverts the
 * delta with a transform (so the element paints at its old location)
 * and animates the transform back to identity.
 *
 * Per-frame state is driven by the vanilla `play()` from `@kinem/core`,
 * not Vue reactivity.
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
import { type ShallowRef, onBeforeUnmount, onMounted, onUpdated, shallowRef } from "vue"

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
   * Shared-element layout id. When set, the composable consumes any
   * rect captured under this id from `layoutGroup` on mount and uses it
   * as the FLIP "previous" rect. On unmount the composable captures its
   * current rect under the same id.
   */
  readonly layoutId?: string
  /**
   * Registry to use for shared-element captures. Defaults to the
   * process-wide `defaultLayoutGroup`.
   */
  readonly layoutGroup?: LayoutGroup
}

export interface UseLayoutResult<T extends HTMLElement = HTMLElement> {
  readonly ref: ShallowRef<T | null>
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
  const elRef: ShallowRef<T | null> = shallowRef(null)
  let prevRect: Rect | null = null
  let controls: Controls | null = null

  const measureAndPlay = (): void => {
    const el = elRef.value
    if (!el) return
    const next = readRect(el)
    let prev = prevRect
    if (!prev && opts.layoutId) {
      const group = opts.layoutGroup ?? defaultLayoutGroup
      const snap = group.consume(opts.layoutId)
      if (snap) prev = snap.rect
    }
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

    const spring = opts.spring ? springEasing(opts.spring) : null
    const def = tween(tweenProps, {
      duration: spring ? spring.duration : (opts.duration ?? 300),
      ...omitUndefined({ easing: spring ?? opts.easing }),
    })
    const playOpts: PlayOpts = omitUndefined({ backend: opts.backend })
    controls = play(def, [el as unknown as StrategyTarget], playOpts)
  }

  onMounted(measureAndPlay)
  onUpdated(measureAndPlay)
  onBeforeUnmount(() => {
    if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
      controls.cancel()
    }
    controls = null
    if (opts.layoutId && prevRect && prevRect.width > 0 && prevRect.height > 0) {
      const group = opts.layoutGroup ?? defaultLayoutGroup
      group.capture(opts.layoutId, prevRect)
    }
  })

  return { ref: elRef }
}
