/**
 * `layout` is a Svelte action that animates the host element between
 * layout positions using FLIP (First, Last, Invert, Play). Parity for
 * React's `useLayout` and the Vue `useLayout` composable.
 *
 *   <div use:layout={{ duration: 300 }}>{...}</div>
 *
 * The action measures the element on bind and again whenever Svelte
 * re-runs the action with new params (i.e. on every layout-relevant
 * update). When the rect changes, it inverts the delta with a transform
 * and animates back to identity via the vanilla `play()` from
 * `@kinem/core`. To explicitly trigger remeasure without changing
 * options, pass a fresh object reference.
 */

import {
  type Controls,
  type EasingFn,
  type PlayOpts,
  type StrategyTarget,
  play,
  tween,
} from "@kinem/core"

export interface LayoutActionOpts {
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

export interface LayoutActionReturn {
  update(next: LayoutActionOpts): void
  destroy(): void
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

export function layout(node: HTMLElement, params: LayoutActionOpts = {}): LayoutActionReturn {
  let prevRect: Rect | null = readRect(node)
  let controls: Controls | null = null
  let opts: LayoutActionOpts = params

  const measureAndPlay = (): void => {
    const next = readRect(node)
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
    controls = play(def, [node as unknown as StrategyTarget], playOpts)
  }

  return {
    update(next) {
      opts = next
      measureAndPlay()
    },
    destroy() {
      if (controls && controls.state !== "cancelled" && controls.state !== "finished") {
        controls.cancel()
      }
      controls = null
    },
  }
}
