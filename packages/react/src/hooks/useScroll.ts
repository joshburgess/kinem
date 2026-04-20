/**
 * `useScroll` binds a vanilla `scroll()` driver to a React ref. The hook
 * attaches the driver as soon as the ref is populated and cancels it on
 * unmount or when the ref is replaced.
 *
 * Options are latched at bind time; to reconfigure, unmount the consuming
 * component or call `cancel()` and let the caller remount. This mirrors
 * the existing `useGesture` and `useAnimation` patterns: the hook never
 * writes React state during scroll activity — progress updates flow to
 * the vanilla driver's `onProgress` callback (when supplied) or
 * `toggleActions`.
 */

import type {
  AnimationDef,
  AnimationProps,
  ScrollHandle,
  ScrollOpts,
  StrategyTarget,
} from "@kinem/core"
import { scroll } from "@kinem/core"
import { useEffect, useMemo, useRef } from "react"

export interface UseScrollResult<T extends Element = Element> {
  readonly ref: (el: T | null) => void
  /** Active scroll handle, or `null` if no element is bound yet. */
  readonly handle: ScrollHandle | null
  /** Cancel the bound scroll driver. Safe to call multiple times. */
  cancel(): void
}

export function useScroll<T extends Element = Element>(
  def: AnimationDef<AnimationProps>,
  opts: ScrollOpts = {},
): UseScrollResult<T> {
  const elRef = useRef<T | null>(null)
  const handleRef = useRef<ScrollHandle | null>(null)
  const defRef = useRef(def)
  defRef.current = def
  const optsRef = useRef(opts)
  optsRef.current = opts

  const result = useMemo<UseScrollResult<T>>(() => {
    const unbind = (): void => {
      handleRef.current?.cancel()
      handleRef.current = null
    }
    const bind = (): void => {
      const el = elRef.current
      if (!el) return
      handleRef.current = scroll(defRef.current, [el as unknown as StrategyTarget], optsRef.current)
    }
    return {
      ref(el) {
        if (el === elRef.current) return
        unbind()
        elRef.current = el
        if (el) bind()
      },
      get handle() {
        return handleRef.current
      },
      cancel() {
        unbind()
      },
    }
  }, [])

  useEffect(() => {
    return () => {
      handleRef.current?.cancel()
      handleRef.current = null
    }
  }, [])

  return result
}
