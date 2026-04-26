/**
 * `ScrollSource` is the abstraction the scroll drivers read from. It
 * exposes the current scroll offset, viewport size, and element
 * geometry, plus hooks for scroll and resize events.
 *
 * The DOM implementation reads from a `Window`-like object and uses
 * `getBoundingClientRect()` on targets. Tests supply their own source
 * to drive scroll position deterministically without jsdom.
 */

import { KinemError } from "../core/errors"
import type { StrategyTarget } from "../render/strategy"

export interface ScrollRect {
  /** Document-relative top (viewport top + scrollY). */
  readonly top: number
  readonly height: number
}

export type ScrollUnsubscribe = () => void

export interface ScrollSource {
  getScrollY(): number
  getViewportHeight(): number
  getRect(el: StrategyTarget): ScrollRect
  onScroll(cb: () => void): ScrollUnsubscribe
  onResize(cb: () => void): ScrollUnsubscribe
}

interface MinimalWindow {
  readonly scrollY: number
  readonly innerHeight: number
  addEventListener(type: string, cb: () => void, opts?: AddEventListenerOptions | boolean): void
  removeEventListener(type: string, cb: () => void): void
}

interface RectCapable {
  getBoundingClientRect?: () => { top: number; height: number }
}

/**
 * Build a `ScrollSource` backed by the given `Window` (or `window` by
 * default). `getRect` converts the viewport-relative top returned by
 * `getBoundingClientRect` into document-relative coordinates.
 */
export function createDomScrollSource(win?: MinimalWindow): ScrollSource {
  const w = win ?? (globalThis as unknown as { window?: MinimalWindow }).window
  if (!w) {
    throw new KinemError(
      "createDomScrollSource(): no window available",
      "pass a window-like object explicitly when running outside the browser",
    )
  }

  return {
    getScrollY: () => w.scrollY,
    getViewportHeight: () => w.innerHeight,
    getRect(el) {
      const rect = (el as unknown as RectCapable).getBoundingClientRect?.()
      if (!rect) return { top: 0, height: 0 }
      return { top: rect.top + w.scrollY, height: rect.height }
    },
    onScroll(cb) {
      w.addEventListener("scroll", cb, { passive: true })
      return () => w.removeEventListener("scroll", cb)
    },
    onResize(cb) {
      w.addEventListener("resize", cb)
      return () => w.removeEventListener("resize", cb)
    },
  }
}
