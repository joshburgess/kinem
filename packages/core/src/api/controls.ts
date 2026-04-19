/**
 * Controls — the PromiseLike handle returned by `play()` and `timeline().play()`.
 *
 * Thin adapter over `StrategyHandle` that:
 *   - adds `then` / `catch` / `finally` so `await play(...)` works
 *   - exposes a `speed` getter/setter (maps to `setSpeed`)
 *   - supports named labels via `seekLabel()`
 *   - returns `this` from every mutating method for fluent chaining
 *
 * The `finished` promise is single-shot: it settles exactly once, on the
 * first natural completion or on `cancel()`. `seek()` and `reverse()`
 * from a finished state DO re-arm the animation (it plays again — scroll-
 * triggered toggle actions rely on this), but the original `finished`
 * promise remains resolved and will not re-fire. Callers who need to
 * observe subsequent cycles should watch `state` or call `play()` again
 * instead of awaiting `finished`.
 *
 * Implemented as a class so the ~15 methods live on the prototype
 * once rather than being reallocated as fresh closures per `play()`.
 * At n=1000 plays that's 15000 fewer closures pinned in memory.
 *
 * Consumers never construct `Controls` directly; use `play()` or
 * `timeline().play()`. The factory is exported for internal use by
 * those modules.
 */

import type { StrategyHandle, StrategyState } from "../render/strategy"

export interface Controls extends PromiseLike<void> {
  pause(): Controls
  resume(): Controls
  /** Seek to `progress` in [0, 1]. */
  seek(progress: number): Controls
  /** Seek to a named label previously registered (e.g. on a timeline). */
  seekLabel(label: string): Controls
  reverse(): Controls
  /**
   * Play from the beginning, forward. No-op if the animation was
   * cancelled. Unpauses if paused, flips back to forward if reversed,
   * and re-arms if already finished.
   */
  restart(): Controls
  cancel(): Controls
  readonly state: StrategyState
  /** Total duration in ms (known ahead of time for every built-in animation). */
  readonly duration: number
  /** Current animation progress in [0, 1]. */
  readonly progress: number
  /** Current playback direction. `1` is forward, `-1` is reversed. */
  readonly direction: 1 | -1
  /** Shortest-path promise of completion. Rejects on cancel. */
  readonly finished: Promise<void>
  /** Labels registered on the underlying animation. Offsets are in [0, 1]. */
  readonly labels: ReadonlyMap<string, number>
  /** Playback speed multiplier. Default 1. Must be > 0. */
  speed: number
  // biome-ignore lint/suspicious/noConfusingVoidType: Promise<void | R> mirrors Promise#catch
  catch<R>(onrejected: (err: unknown) => R | PromiseLike<R>): Promise<void | R>
  finally(onfinally?: (() => void) | null): Promise<void>
}

const EMPTY_LABELS: ReadonlyMap<string, number> = new Map()

class ControlsImpl implements Controls {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: read via getters below
  readonly #handle: StrategyHandle
  readonly #duration: number
  readonly #labels: ReadonlyMap<string, number>
  #speed = 1

  constructor(handle: StrategyHandle, duration: number, labels: ReadonlyMap<string, number>) {
    this.#handle = handle
    this.#duration = duration
    this.#labels = labels
  }

  pause(): Controls {
    this.#handle.pause()
    return this
  }
  resume(): Controls {
    this.#handle.resume()
    return this
  }
  seek(progress: number): Controls {
    this.#handle.seek(progress)
    return this
  }
  seekLabel(label: string): Controls {
    const offset = this.#labels.get(label)
    if (offset === undefined) {
      throw new Error(`seekLabel(): unknown label "${label}"`)
    }
    this.#handle.seek(offset)
    return this
  }
  reverse(): Controls {
    this.#handle.reverse()
    return this
  }
  restart(): Controls {
    const h = this.#handle
    // Cancel is terminal and sticky; a cancelled animation can't be
    // restarted. Callers that want to replay from zero after cancel
    // should call `play()` again to build a fresh handle.
    if (h.state === "cancelled") return this
    // Flip to forward first, before seek(0). If we seeked first with
    // direction still at -1, `seek(0)` from a finished state wouldn't
    // re-arm (isFinished(0) returns true with direction=-1); flipping
    // direction after would leave us stuck. Reversing first unblocks
    // the re-arm path.
    if (h.direction === -1) h.reverse()
    h.seek(0)
    // seek() doesn't change play/pause state. Unpause so playback
    // actually continues.
    if (h.state === "paused") h.resume()
    return this
  }
  cancel(): Controls {
    this.#handle.cancel()
    return this
  }
  get state(): StrategyState {
    return this.#handle.state
  }
  get duration(): number {
    return this.#duration
  }
  get progress(): number {
    return this.#handle.progress
  }
  get direction(): 1 | -1 {
    return this.#handle.direction
  }
  get finished(): Promise<void> {
    return this.#handle.finished
  }
  get labels(): ReadonlyMap<string, number> {
    return this.#labels
  }
  get speed(): number {
    return this.#speed
  }
  set speed(v: number) {
    this.#handle.setSpeed(v)
    this.#speed = v
  }
  // biome-ignore lint/suspicious/noThenProperty: Controls is PromiseLike by design
  // biome-ignore lint/suspicious/noConfusingVoidType: T1 defaults void for Promise<void>
  then<T1 = void, T2 = never>(
    // biome-ignore lint/suspicious/noConfusingVoidType: PromiseLike<void> callback
    onfulfilled?: ((v: void) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((err: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this.#handle.finished.then(onfulfilled, onrejected)
  }
  catch<R>(onrejected: (err: unknown) => R | PromiseLike<R>): Promise<void | R> {
    return this.#handle.finished.catch(onrejected)
  }
  finally(onfinally?: (() => void) | null): Promise<void> {
    return this.#handle.finished.finally(onfinally)
  }
}

export function createControls(
  handle: StrategyHandle,
  duration: number,
  labels: ReadonlyMap<string, number> = EMPTY_LABELS,
): Controls {
  return new ControlsImpl(handle, duration, labels)
}
