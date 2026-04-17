/**
 * Devtools for motif-animate. Headless APIs that build on the core
 * animation tracker. The inspector returns snapshots of currently
 * running animations; the recorder serializes tracker events to a
 * replayable log. Both are framework-agnostic and do not require a
 * DOM, which keeps them testable in node.
 *
 * An in-page overlay and Chrome extension will be layered on top of
 * these in later iterations. Ship the data model first so the UI has
 * something solid to consume.
 *
 * Importing this package turns on the core tracker as a side effect.
 * The tracker is off by default (so production `play()` calls pay no
 * devtools overhead); any app that imports devtools gets tracking
 * automatically from this point forward.
 */

import { enableTracker } from "motif-animate"

enableTracker()

export {
  type AnimationSnapshot,
  type InspectorSnapshot,
  snapshot,
} from "./inspector"
export {
  type InspectorHandle,
  type MountInspectorOpts,
  type OverlayPosition,
  mountInspector,
} from "./overlay"
export {
  type RecordedEvent,
  type Recorder,
  type RecorderOpts,
  createRecorder,
} from "./recorder"
export {
  type MountTimelineOpts,
  type TimelineHandle,
  type TimelinePosition,
  mountTimeline,
} from "./timeline"
