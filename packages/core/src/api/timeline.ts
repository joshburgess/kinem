/**
 * GSAP-style imperative timeline builder.
 *
 * A timeline accumulates entries of (animation, target, startMs) plus a
 * map of named labels. `play()` turns each entry into a "slotted" clone
 * of its `AnimationDef` (duration = total timeline length, active only
 * between startMs and startMs + duration), dispatches each slotted def
 * to the strategy router, and combines the resulting handles so every
 * sub-animation shares pause/seek/reverse/speed semantics.
 *
 * Because every entry is slotted to the same total duration and they
 * all share the caller-supplied clock, they stay in lock-step without
 * any explicit coordinator.
 *
 * Positioning (the `at` option on `add()`) follows GSAP conventions:
 *   - number:   absolute time in ms from timeline start
 *   - `"<"`:    the start time of the previously added animation
 *   - `">"`:    the end time of the previously added animation (default)
 *   - any other string: the ms offset of a previously registered label
 *
 * `offset` is a signed ms adjustment added to the resolved position.
 */

import { linear } from "../core/easing"
import type { AnimationDef } from "../core/types"
import {
  type AnimationProps,
  type StrategyHandle,
  type StrategyTarget,
  combineHandles,
  playStrategy,
} from "../render/strategy"
import { type Controls, createControls } from "./controls"
import { type PlayOpts, type Target, resolveTargets } from "./play"

export type TimelinePosition = number | "<" | ">" | string

export interface TimelineAddOpts {
  /**
   * Where to place this animation on the timeline. See the module doc
   * for the full set of conventions. Defaults to `">"` (append after
   * the previously added animation).
   */
  readonly at?: TimelinePosition
  /** Signed ms offset added to the resolved `at` position. */
  readonly offset?: number
  /** Register a label at this animation's resolved start time. */
  readonly label?: string
}

export interface Timeline {
  /**
   * Add an animation at the resolved position. Subsequent calls that
   * reference `"<"` or `">"` resolve relative to this entry.
   */
  add(def: AnimationDef<AnimationProps>, target: Target, opts?: TimelineAddOpts): Timeline
  /** Register a named label at the given position (defaults to `">"`). */
  addLabel(name: string, at?: TimelinePosition, offset?: number): Timeline
  /** Resolve targets and begin playing. */
  play(opts?: PlayOpts): Controls
  /** Current total duration in ms. Grows as entries are added. */
  readonly duration: number
  /** Labels keyed by name to their ms offset from timeline start. */
  readonly labels: ReadonlyMap<string, number>
}

interface Entry {
  readonly def: AnimationDef<AnimationProps>
  readonly target: Target
  readonly startMs: number
}

/**
 * Wrap `def` so it occupies only the window [startMs, startMs + def.duration]
 * inside a `totalMs`-long containing animation. Outside that window the
 * value is held at the appropriate endpoint.
 */
function slotted(
  def: AnimationDef<AnimationProps>,
  startMs: number,
  totalMs: number,
): AnimationDef<AnimationProps> {
  const endMs = startMs + def.duration
  return {
    duration: totalMs,
    easing: linear,
    interpolate: (p) => {
      const clamped = p <= 0 ? 0 : p >= 1 ? 1 : p
      const t = clamped * totalMs
      if (t <= startMs) return def.interpolate(0)
      if (t >= endMs) return def.interpolate(1)
      return def.interpolate(def.duration === 0 ? 1 : (t - startMs) / def.duration)
    },
  }
}

function emptyHandle(): StrategyHandle {
  return {
    pause() {},
    resume() {},
    seek() {},
    reverse() {},
    setSpeed() {},
    cancel() {},
    state: "finished",
    finished: Promise.resolve(),
  }
}

function msLabelsToProgress(
  labels: ReadonlyMap<string, number>,
  totalMs: number,
): ReadonlyMap<string, number> {
  if (totalMs === 0) return new Map()
  const out = new Map<string, number>()
  for (const [name, ms] of labels) {
    const p = ms / totalMs
    out.set(name, p < 0 ? 0 : p > 1 ? 1 : p)
  }
  return out
}

export function timeline(): Timeline {
  const entries: Entry[] = []
  const labels = new Map<string, number>()
  let lastStart = 0
  let lastEnd = 0
  let totalMs = 0

  const resolve = (at: TimelinePosition | undefined, offset: number): number => {
    let base: number
    if (at === undefined || at === ">") {
      base = lastEnd
    } else if (at === "<") {
      base = lastStart
    } else if (typeof at === "number") {
      base = at
    } else {
      const ms = labels.get(at)
      if (ms === undefined) {
        throw new Error(`timeline: unknown label "${at}"`)
      }
      base = ms
    }
    const pos = base + offset
    return pos < 0 ? 0 : pos
  }

  const tl: Timeline = {
    add(def, target, opts = {}) {
      const startMs = resolve(opts.at, opts.offset ?? 0)
      entries.push({ def, target, startMs })
      lastStart = startMs
      lastEnd = startMs + def.duration
      if (lastEnd > totalMs) totalMs = lastEnd
      if (opts.label !== undefined) labels.set(opts.label, startMs)
      return tl
    },
    addLabel(name, at, offset = 0) {
      labels.set(name, resolve(at, offset))
      return tl
    },
    play(opts = {}) {
      if (entries.length === 0 || totalMs === 0) {
        return createControls(emptyHandle(), {
          duration: totalMs,
          labels: msLabelsToProgress(labels, totalMs),
        })
      }

      const handles: StrategyHandle[] = []
      for (const e of entries) {
        const targets = resolveTargets(e.target, opts)
        if (targets.length === 0) continue
        handles.push(playStrategy(slotted(e.def, e.startMs, totalMs), targets, opts))
      }

      return createControls(combineHandles(handles), {
        duration: totalMs,
        labels: msLabelsToProgress(labels, totalMs),
      })
    },
    get duration() {
      return totalMs
    },
    get labels() {
      return labels
    },
  }

  return tl
}
