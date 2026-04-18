// Registers built-in interpolators (number, color, transform, path,
// CSS units, number arrays) for side-effect. The `slim` entry omits
// this import, leaving consumers to register what they need.
import "./interpolate/register-defaults"

export type {
  AnimationDef,
  EasingFn,
  Interpolator,
  LoopOpts,
  ParallelValues,
  StaggerFn,
  StaggerFrom,
  StaggerOpts,
  ValueOf,
} from "./core/types"

export {
  cubicBezier,
  easeIn,
  easeInOut,
  easeOut,
  isSpringEasing,
  linear,
  springEasing,
  steps,
  type SpringEasingFn,
  type SpringOpts,
  type StepPosition,
} from "./core/easing"

export {
  animation,
  delay,
  loop,
  map,
  parallel,
  reverse,
  sequence,
  stagger,
} from "./core/animation"

export { interpolateNumber } from "./interpolate/number"
export { type UnitValue, UnitMismatchError, interpolateUnit, parseUnit } from "./interpolate/units"
export { type ColorFormat, interpolateColor, isColor } from "./interpolate/color"
export { interpolateTransform, parseTransform } from "./interpolate/transform"
export { type PathCommand, interpolatePath, parsePath, stringifyPath } from "./interpolate/path"
export {
  type InterpolatorEntry,
  type ValueInterpolator,
  findInterpolator,
  interpolate,
  registerInterpolator,
} from "./interpolate/registry"

export { type TweenOpts, type TweenProps, type TweenValue, tween } from "./api/tween"
export { spring } from "./api/spring"
export {
  type KeyframeStops,
  type KeyframesOpts,
  type KeyframesValue,
  keyframes,
} from "./api/keyframes"

export {
  type Clock,
  type ClockOpts,
  type NowFn,
  createClock,
  defaultClock,
} from "./scheduler/clock"
export {
  type FrameJob,
  type FrameScheduler,
  type FrameSchedulerOpts,
  type FrameState,
  type Phase,
  type RafLike,
  createFrameScheduler,
  frame,
} from "./scheduler/frame"
export { type Batch, type ReadJob, type WriteJob, batch, createBatch } from "./scheduler/batch"

export {
  type PropertyInfo,
  type PropertyTier,
  classify,
  isCompositorSafe,
  partitionByTier,
  pseudoToTransformFn,
} from "./render/properties"
export { type ElementShim, type PropertyValue, type StyleShim, applyValues } from "./render/apply"
export {
  type RafHandle,
  type RafOpts,
  type RafState,
  type PropertyMap,
  playRaf,
} from "./render/raf"
export {
  type CanvasCommit,
  type CanvasHandle,
  type CanvasOpts,
  playCanvas,
} from "./render/canvas"
export {
  type GLLike,
  type UniformBinding,
  type UniformBindings,
  type UniformLocation,
  type WebGLHandle,
  type WebGLOpts,
  float,
  mat4,
  playUniforms,
  vec2,
  vec3,
  vec4,
} from "./render/webgl"
export {
  type TimingHandle,
  type TimingOpts,
  type TimingState,
  createTiming,
} from "./render/timing"
export {
  type Animatable,
  type Keyframe,
  type WaapiAnimation,
  type WaapiHandle,
  type WaapiOpts,
  type WaapiState,
  buildKeyframes,
  playWaapi,
} from "./render/waapi"
export {
  type AnimationProps,
  type StrategyBackend,
  type StrategyHandle,
  type StrategyOpts,
  type StrategyState,
  type StrategyTarget,
  detectWaapi,
  discoverProperties,
  playStrategy,
} from "./render/strategy"
export { type StrokeDrawOpts, strokeDraw } from "./render/svg"

export {
  type GridOpts,
  type ShuffleOpts,
  type WaveOpts,
  fromGrid,
  shuffle,
  wave,
} from "./text/stagger-patterns"
export { type SplitBy, type SplitOpts, type SplitResult, splitText } from "./text/split"

export type { Controls } from "./api/controls"
export { type PlayMode, type PlayOpts, type Target, play } from "./api/play"
export {
  type AnimationRecord,
  type TrackerEvent,
  type TrackerListener,
  __resetTracker,
  enableTracker,
  isTrackerEnabled,
  listActive as listActiveAnimations,
  subscribe as subscribeTracker,
  trackAnimation,
} from "./devtools/tracker"
export {
  type Timeline,
  type TimelineAddOpts,
  type TimelinePosition,
  timeline,
} from "./api/timeline"
export {
  type ScrollHandle,
  type ScrollOpts,
  type ScrollTriggerConfig,
  scroll,
} from "./api/scroll"
export {
  type ScrollBounds,
  type ScrollZone,
  type TriggerGeom,
  type TriggerPos,
  computeBounds,
  parseTriggerPos,
  progressAt,
  zoneAt,
} from "./scroll/trigger"
export {
  type ScrollRect,
  type ScrollSource,
  type ScrollUnsubscribe,
  createDomScrollSource,
} from "./scroll/source"
export {
  type ScrollSyncHandle,
  type ScrollSyncOpts,
  type ScrollSyncState,
  playScrollSync,
} from "./scroll/sync"
export {
  type ScrollTriggeredHandle,
  type ScrollTriggeredOpts,
  type ScrollTriggeredState,
  type ToggleAction,
  type ToggleActions,
  parseToggleActions,
  playScrollTriggered,
} from "./scroll/triggered"

export {
  type Point,
  type PointerBindTarget,
  type PointerEventShim,
  type PointerHandlers,
  type PointerSample,
  type PointerSource,
  type PointerUnsubscribe,
  type VelocityOpts,
  type VelocityTracker,
  createDomPointerSource,
  createVelocityTracker,
} from "./gesture/pointer"
export {
  type DragAxis,
  type DragBounds,
  type DragEvent,
  type DragHandle,
  type DragOpts,
  type DragPhase,
  type DragReleaseOpts,
  type DragSnap,
  playDrag,
} from "./gesture/drag"
export {
  type HoverHandle,
  type HoverOpts,
  type HoverState,
  playHover,
} from "./gesture/hover"
export {
  type DragPublicOpts,
  type GestureTarget,
  type HoverPublicOpts,
  gesture,
} from "./api/gesture"

export {
  type WorkerAnimSpec,
  type WorkerComputeRequest,
  type WorkerComputeResponse,
  type WorkerEasingId,
  type WorkerValues,
  computeValues,
} from "./render/worker-protocol"
export {
  type Computer,
  type ComputerMode,
  type WorkerComputerOpts,
  createWorkerComputer,
} from "./render/worker"
