/**
 * Headless inspector: reads the core animation tracker and returns a
 * plain, JSON-serializable snapshot of currently running animations.
 *
 *   const snap = snapshot()
 *   snap.animations.forEach(a => console.log(a.id, a.state, a.progress))
 *
 * This is the data layer for the overlay UI that will live in a later
 * iteration. By keeping snapshots pure and synchronous, the UI can
 * poll or subscribe at whatever cadence it likes. The target list is
 * exposed as lightweight descriptors (tag name, id, classes) instead
 * of raw references so snapshots can be serialized and sent across a
 * postMessage boundary (useful for a DevTools extension).
 */

import { type AnimationRecord, listActiveAnimations } from "kinem"

export interface TargetDescriptor {
  readonly kind: "element" | "unknown"
  readonly tag?: string
  readonly id?: string
  readonly classes?: readonly string[]
}

export interface AnimationSnapshot {
  readonly id: number
  readonly duration: number
  readonly state: string
  readonly progress: number
  readonly startedAt: number
  readonly backend: string
  readonly targets: readonly TargetDescriptor[]
}

export interface InspectorSnapshot {
  readonly capturedAt: number
  readonly animations: readonly AnimationSnapshot[]
}

function describeTarget(target: unknown): TargetDescriptor {
  if (target && typeof target === "object") {
    const el = target as { tagName?: string; id?: string; className?: string }
    if (typeof el.tagName === "string") {
      const classes =
        typeof el.className === "string" && el.className.length > 0
          ? el.className.split(/\s+/).filter(Boolean)
          : undefined
      const desc: {
        kind: "element"
        tag: string
        id?: string
        classes?: readonly string[]
      } = { kind: "element", tag: el.tagName.toLowerCase() }
      if (typeof el.id === "string" && el.id.length > 0) desc.id = el.id
      if (classes) desc.classes = classes
      return desc
    }
  }
  return { kind: "unknown" }
}

function toSnapshot(record: AnimationRecord): AnimationSnapshot {
  return {
    id: record.id,
    duration: record.duration,
    state: record.state,
    progress: record.progress,
    startedAt: record.startedAt,
    backend: record.backend,
    targets: record.targets.map(describeTarget),
  }
}

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

/** Take a snapshot of all currently active animations. */
export function snapshot(): InspectorSnapshot {
  return {
    capturedAt: now(),
    animations: listActiveAnimations().map(toSnapshot),
  }
}
