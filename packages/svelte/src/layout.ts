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

export interface LayoutActionOpts {
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
   * Shared-element layout id. When set, the action consumes any rect
   * captured under this id from `layoutGroup` on bind and uses it as
   * the FLIP "previous" rect (so the element animates from where the
   * old element was). On destroy the action captures its current rect
   * under the same id.
   */
  readonly layoutId?: string
  /**
   * Registry to use for shared-element captures. Defaults to the
   * process-wide `defaultLayoutGroup`.
   */
  readonly layoutGroup?: LayoutGroup
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
  let opts: LayoutActionOpts = params
  // If a layoutId is set and a sibling captured a rect for it, use that
  // captured rect as the FLIP "previous" so the element animates from
  // the old element's position on the next layout pass.
  let prevRect: Rect | null = null
  if (opts.layoutId) {
    const group = opts.layoutGroup ?? defaultLayoutGroup
    const snap = group.consume(opts.layoutId)
    if (snap) prevRect = snap.rect
  }
  if (!prevRect) prevRect = readRect(node)
  let controls: Controls | null = null
  // Trigger an initial measure-and-play if we picked up a captured rect
  // (so the shared-element transition fires without waiting for the
  // first svelte-driven update).
  // We have to defer one microtask so the binding completes first.
  if (opts.layoutId) {
    queueMicrotask(() => {
      // measureAndPlay is defined below; this closure runs after the
      // function declaration is evaluated.
      measureAndPlay()
    })
  }

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

    const spring = opts.spring ? springEasing(opts.spring) : null
    const def = tween(tweenProps, {
      duration: spring ? spring.duration : (opts.duration ?? 300),
      ...omitUndefined({ easing: spring ?? opts.easing }),
    })
    const playOpts: PlayOpts = omitUndefined({ backend: opts.backend })
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
      if (opts.layoutId && prevRect && prevRect.width > 0 && prevRect.height > 0) {
        const group = opts.layoutGroup ?? defaultLayoutGroup
        group.capture(opts.layoutId, prevRect)
      }
    },
  }
}
