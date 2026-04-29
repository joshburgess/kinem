/**
 * `playViewTransition` wraps the browser's
 * [View Transitions API](https://developer.mozilla.org/docs/Web/API/View_Transitions_API)
 * (`document.startViewTransition`) and returns a tracker-aware
 * `Controls` handle so view-transition lifecycles show up alongside
 * regular kinem animations in the devtools panel.
 *
 *   const ctl = playViewTransition(() => {
 *     setRoute("/details") // mutate the DOM however you like
 *   })
 *   await ctl // resolves once the cross-fade has finished
 *
 * Behavior:
 *  - When the API is unavailable (Firefox, older Safari, SSR), the
 *    callback runs synchronously and the returned controls resolve
 *    immediately. Callers don't need to feature-detect.
 *  - `cancel()` calls `viewTransition.skipTransition()`. The browser
 *    finishes the DOM mutation but skips the animated swap.
 *  - `pause` / `resume` / `seek` / `seekLabel` / `reverse` / `restart`
 *    are no-ops: the browser owns the timeline and exposes no hooks.
 *  - `duration` is `0` (unknown). The devtools panel treats this as the
 *    ambient sentinel.
 *  - `progress` is `0` until the transition resolves, then `1`.
 */

import { type StrategyState, type StrategyTarget } from "../render/strategy"
import { type Controls } from "./controls"
import { isTrackerEnabled, trackAnimation } from "../devtools/tracker"

/** Subset of the DOM `ViewTransition` interface we depend on. */
export interface ViewTransitionLike {
  readonly finished: Promise<void>
  readonly ready?: Promise<void>
  readonly updateCallbackDone?: Promise<void>
  skipTransition(): void
}

/** Subset of `Document` we depend on. */
export interface ViewTransitionDocumentLike {
  startViewTransition?(callback: () => void | Promise<void>): ViewTransitionLike
}

export interface PlayViewTransitionOpts {
  /**
   * Override the document used to start the transition. Defaults to the
   * global `document`. Useful for testing, or for running against an
   * iframe document.
   */
  readonly document?: ViewTransitionDocumentLike
}

const EMPTY_LABELS: ReadonlyMap<string, number> = new Map()

function resolvedControls(): Controls {
  const finished = Promise.resolve()
  const noop = (): Controls => controls
  const controls: Controls = {
    pause: noop as Controls["pause"],
    resume: noop as Controls["resume"],
    seek: noop as Controls["seek"],
    seekLabel: noop as Controls["seekLabel"],
    reverse: noop as Controls["reverse"],
    restart: noop as Controls["restart"],
    cancel: noop as Controls["cancel"],
    duration: 0,
    state: "finished" as StrategyState,
    progress: 1,
    direction: 1,
    finished,
    labels: EMPTY_LABELS,
    speed: 1,
    // biome-ignore lint/suspicious/noThenProperty: Controls is intentionally thenable
    then<T1 = void, T2 = never>(
      onfulfilled?: ((v: void) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((err: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
      return finished.then(onfulfilled, onrejected)
    },
    catch<R>(onrejected: (err: unknown) => R | PromiseLike<R>): Promise<void | R> {
      return finished.catch(onrejected)
    },
    finally(onfinally?: (() => void) | null): Promise<void> {
      return finished.finally(onfinally)
    },
  }
  return controls
}

function viewTransitionControls(vt: ViewTransitionLike): Controls {
  let state: StrategyState = "playing"
  let progress = 0
  // Listen for natural completion so consumers reading `.state` after
  // an `await` see the final value.
  vt.finished.then(
    () => {
      if (state !== "cancelled") {
        state = "finished"
        progress = 1
      }
    },
    () => {
      if (state !== "cancelled") {
        state = "cancelled"
      }
    },
  )

  const noop = (): Controls => controls
  const controls: Controls = {
    pause: noop as Controls["pause"],
    resume: noop as Controls["resume"],
    seek: noop as Controls["seek"],
    seekLabel: noop as Controls["seekLabel"],
    reverse: noop as Controls["reverse"],
    restart: noop as Controls["restart"],
    cancel(): Controls {
      if (state === "playing") {
        state = "cancelled"
        vt.skipTransition()
      }
      return controls
    },
    duration: 0,
    get state(): StrategyState {
      return state
    },
    get progress(): number {
      return progress
    },
    direction: 1,
    get finished(): Promise<void> {
      return vt.finished
    },
    labels: EMPTY_LABELS,
    speed: 1,
    // biome-ignore lint/suspicious/noThenProperty: Controls is intentionally thenable
    then<T1 = void, T2 = never>(
      onfulfilled?: ((v: void) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((err: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
      return vt.finished.then(onfulfilled, onrejected)
    },
    catch<R>(onrejected: (err: unknown) => R | PromiseLike<R>): Promise<void | R> {
      return vt.finished.catch(onrejected)
    },
    finally(onfinally?: (() => void) | null): Promise<void> {
      return vt.finished.finally(onfinally)
    },
  }
  return controls
}

export function playViewTransition(
  mutate: () => void | Promise<void>,
  opts: PlayViewTransitionOpts = {},
): Controls {
  const doc =
    opts.document ??
    (typeof document !== "undefined" ? (document as unknown as ViewTransitionDocumentLike) : undefined)

  if (!doc || typeof doc.startViewTransition !== "function") {
    // Fallback path: run the mutation eagerly and resolve immediately.
    // Errors thrown synchronously bubble; async errors surface on the
    // promise chain consumers may await.
    const result = mutate()
    if (result && typeof (result as Promise<void>).then === "function") {
      const finished = (result as Promise<void>).then(
        () => undefined,
        () => undefined,
      )
      const fallback = resolvedControls()
      Object.defineProperty(fallback, "finished", { value: finished })
      return fallback
    }
    return resolvedControls()
  }

  const vt = doc.startViewTransition(mutate)
  const controls = viewTransitionControls(vt)
  if (isTrackerEnabled()) {
    const targets: readonly StrategyTarget[] = []
    trackAnimation(controls, targets, "view-transition")
  }
  return controls
}
