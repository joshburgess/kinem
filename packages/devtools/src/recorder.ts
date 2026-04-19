/**
 * Event recorder. Subscribes to the core tracker and serializes every
 * start/finish/cancel to a plain JSON log. Useful for reproducing
 * bugs: record a session, export the log, replay later against a
 * different build.
 *
 *   const rec = createRecorder()
 *   rec.start()
 *   // ...run your app...
 *   rec.stop()
 *   const log = rec.flush()   // JSON-serializable array
 *
 * Start/stop are idempotent. The recorder holds events in memory; for
 * long sessions pass an `onEvent` callback to stream them out instead
 * of buffering.
 */

import { type TrackerEvent, subscribeTracker } from "kinem"

export interface RecordedEvent {
  readonly at: number
  readonly type: "start" | "finish" | "cancel"
  readonly id: number
  readonly duration?: number
}

export interface RecorderOpts {
  /**
   * Called for every event as it arrives (in addition to buffering).
   * Useful for streaming to disk or a remote sink.
   */
  readonly onEvent?: (event: RecordedEvent) => void
}

export interface Recorder {
  start(): void
  stop(): void
  /** Return the buffered events and clear the internal buffer. */
  flush(): readonly RecordedEvent[]
  /** True while the recorder is subscribed. */
  readonly isRecording: boolean
}

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function toRecorded(event: TrackerEvent): RecordedEvent {
  const at = now()
  if (event.type === "start") {
    return { at, type: "start", id: event.id, duration: event.record.duration }
  }
  return { at, type: event.type, id: event.id }
}

export function createRecorder(opts: RecorderOpts = {}): Recorder {
  let unsubscribe: (() => void) | null = null
  let buffer: RecordedEvent[] = []

  return {
    start() {
      if (unsubscribe) return
      unsubscribe = subscribeTracker((event) => {
        const recorded = toRecorded(event)
        buffer.push(recorded)
        opts.onEvent?.(recorded)
      })
    },
    stop() {
      if (!unsubscribe) return
      unsubscribe()
      unsubscribe = null
    },
    flush() {
      const out = buffer
      buffer = []
      return out
    },
    get isRecording() {
      return unsubscribe !== null
    },
  }
}
