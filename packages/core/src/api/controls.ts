/**
 * Controls — the PromiseLike handle returned by `play()` and `timeline().play()`.
 *
 * Thin adapter over `StrategyHandle` that:
 *   - adds `then` / `catch` / `finally` so `await play(...)` works
 *   - exposes a `speed` getter/setter (maps to `setSpeed`)
 *   - supports named labels via `seekLabel()`
 *   - returns `this` from every mutating method for fluent chaining
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
  cancel(): Controls
  readonly state: StrategyState
  /** Total duration in ms (known ahead of time for every built-in animation). */
  readonly duration: number
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

export interface ControlsOpts {
  readonly duration: number
  readonly labels?: ReadonlyMap<string, number>
}

export function createControls(handle: StrategyHandle, opts: ControlsOpts): Controls {
  const labels = opts.labels ?? new Map<string, number>()
  let speed = 1

  const c: Controls = {
    pause() {
      handle.pause()
      return c
    },
    resume() {
      handle.resume()
      return c
    },
    seek(progress: number) {
      handle.seek(progress)
      return c
    },
    seekLabel(label: string) {
      const offset = labels.get(label)
      if (offset === undefined) {
        throw new Error(`seekLabel(): unknown label "${label}"`)
      }
      handle.seek(offset)
      return c
    },
    reverse() {
      handle.reverse()
      return c
    },
    cancel() {
      handle.cancel()
      return c
    },
    get state() {
      return handle.state
    },
    get duration() {
      return opts.duration
    },
    get finished() {
      return handle.finished
    },
    get labels() {
      return labels
    },
    get speed() {
      return speed
    },
    set speed(v: number) {
      handle.setSpeed(v)
      speed = v
    },
    // biome-ignore lint/suspicious/noThenProperty: Controls is PromiseLike by design
    // biome-ignore lint/suspicious/noConfusingVoidType: T1 defaults void for Promise<void>
    then<T1 = void, T2 = never>(
      // biome-ignore lint/suspicious/noConfusingVoidType: PromiseLike<void> callback
      onfulfilled?: ((v: void) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((err: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
      return handle.finished.then(onfulfilled, onrejected)
    },
    catch<R>(onrejected: (err: unknown) => R | PromiseLike<R>) {
      return handle.finished.catch(onrejected)
    },
    finally(onfinally?: (() => void) | null) {
      return handle.finished.finally(onfinally)
    },
  }

  return c
}
