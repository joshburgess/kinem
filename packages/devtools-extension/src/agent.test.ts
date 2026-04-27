import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type AnimationRecordLike,
  type HookLike,
  connect,
  describeTarget,
  handleCommand,
  toSnapshot,
} from "./agent"
import { AGENT_SOURCE, type AgentEnvelope } from "./shared/protocol"

type HookEvent =
  | { readonly type: "start"; readonly id: number; readonly record: AnimationRecordLike }
  | { readonly type: "finish"; readonly id: number }
  | { readonly type: "cancel"; readonly id: number }

interface FakeControls {
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  seek: ReturnType<typeof vi.fn>
}

function makeRecord(
  id: number,
  overrides: Partial<Omit<AnimationRecordLike, "controls">> = {},
): { record: AnimationRecordLike; controls: FakeControls } {
  const controls: FakeControls = {
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    seek: vi.fn(),
  }
  const record: AnimationRecordLike = {
    id,
    duration: 200,
    state: "running",
    progress: 0.25,
    startedAt: 0,
    backend: "raf",
    targets: [{ tagName: "DIV", id: "el", className: "a b" }],
    controls: controls as unknown as AnimationRecordLike["controls"],
    ...overrides,
  }
  return { record, controls }
}

function makeHook(records: AnimationRecordLike[]): {
  hook: HookLike
  trigger: (e: HookEvent) => void
} {
  const subs = new Set<(e: HookEvent) => void>()
  const hook: HookLike = {
    version: 1,
    listActive: () => records,
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
  const trigger = (e: HookEvent): void => {
    for (const fn of subs) fn(e)
  }
  return { hook, trigger }
}

let postSpy: ReturnType<typeof vi.spyOn>
const captured: AgentEnvelope[] = []

beforeEach(() => {
  captured.length = 0
  postSpy = vi.spyOn(window, "postMessage").mockImplementation((message: unknown) => {
    captured.push(message as AgentEnvelope)
  })
})

afterEach(() => {
  postSpy.mockRestore()
  vi.useRealTimers()
})

describe("describeTarget", () => {
  it("describes an element-shaped object with tag, id, and classes", () => {
    const desc = describeTarget({ tagName: "BUTTON", id: "btn", className: "primary big" })
    expect(desc).toEqual({ kind: "element", tag: "button", id: "btn", classes: ["primary", "big"] })
  })

  it("omits empty id and class fields", () => {
    const desc = describeTarget({ tagName: "DIV", id: "", className: "" })
    expect(desc).toEqual({ kind: "element", tag: "div" })
  })

  it("returns kind=unknown for primitives", () => {
    expect(describeTarget(null)).toEqual({ kind: "unknown" })
    expect(describeTarget(42)).toEqual({ kind: "unknown" })
    expect(describeTarget("string")).toEqual({ kind: "unknown" })
  })

  it("returns kind=unknown for objects without tagName", () => {
    expect(describeTarget({ foo: "bar" })).toEqual({ kind: "unknown" })
  })
})

describe("toSnapshot", () => {
  it("maps record fields and describes targets", () => {
    const { record } = makeRecord(7)
    const snap = toSnapshot(record)
    expect(snap.id).toBe(7)
    expect(snap.duration).toBe(200)
    expect(snap.state).toBe("running")
    expect(snap.progress).toBe(0.25)
    expect(snap.backend).toBe("raf")
    expect(snap.targets).toHaveLength(1)
    expect(snap.targets[0]?.kind).toBe("element")
    expect(snap.targets[0]?.tag).toBe("div")
  })
})

describe("connect", () => {
  it("posts hello + initial snapshot and seeds byId", () => {
    const { record: r1 } = makeRecord(1)
    const { record: r2 } = makeRecord(2)
    const { hook } = makeHook([r1, r2])
    const byId = new Map<number, AnimationRecordLike>()

    connect(hook, byId)

    expect(byId.get(1)).toBe(r1)
    expect(byId.get(2)).toBe(r2)
    expect(captured).toHaveLength(2)
    expect(captured[0]?.source).toBe(AGENT_SOURCE)
    expect(captured[0]?.event).toEqual({ kind: "hello", hookVersion: 1 })
    const second = captured[1]?.event
    if (second?.kind !== "snapshot") throw new Error("expected snapshot envelope")
    expect(second.animations.map((a) => a.id)).toEqual([1, 2])
  })

  it("subscribes and forwards start events", () => {
    const { hook, trigger } = makeHook([])
    const byId = new Map<number, AnimationRecordLike>()
    connect(hook, byId)
    captured.length = 0

    const { record } = makeRecord(99)
    trigger({ type: "start", id: 99, record })

    expect(byId.get(99)).toBe(record)
    expect(captured).toHaveLength(1)
    const ev = captured[0]?.event
    if (ev?.kind !== "start") throw new Error("expected start envelope")
    expect(ev.animation.id).toBe(99)
  })

  it("subscribes and forwards finish events, dropping the record", () => {
    const { record } = makeRecord(5)
    const { hook, trigger } = makeHook([record])
    const byId = new Map<number, AnimationRecordLike>()
    connect(hook, byId)
    captured.length = 0

    trigger({ type: "finish", id: 5 })
    expect(byId.has(5)).toBe(false)
    expect(captured[0]?.event).toEqual({ kind: "finish", id: 5 })
  })

  it("subscribes and forwards cancel events, dropping the record", () => {
    const { record } = makeRecord(8)
    const { hook, trigger } = makeHook([record])
    const byId = new Map<number, AnimationRecordLike>()
    connect(hook, byId)
    captured.length = 0

    trigger({ type: "cancel", id: 8 })
    expect(byId.has(8)).toBe(false)
    expect(captured[0]?.event).toEqual({ kind: "cancel", id: 8 })
  })
})

describe("handleCommand", () => {
  it("ping posts hello + snapshot", () => {
    const { hook } = makeHook([])
    handleCommand({ kind: "ping" }, new Map(), hook)
    expect(captured.map((c) => c.event.kind)).toEqual(["hello", "snapshot"])
  })

  it("request-snapshot posts a single snapshot", () => {
    const { record } = makeRecord(3)
    const { hook } = makeHook([record])
    handleCommand({ kind: "request-snapshot" }, new Map(), hook)
    expect(captured).toHaveLength(1)
    const ev = captured[0]?.event
    if (ev?.kind !== "snapshot") throw new Error("expected snapshot")
    expect(ev.animations.map((a) => a.id)).toEqual([3])
  })

  it("pause-all calls pause on every active record", () => {
    const a = makeRecord(1)
    const b = makeRecord(2)
    const { hook } = makeHook([a.record, b.record])
    handleCommand({ kind: "pause-all" }, new Map(), hook)
    expect(a.controls.pause).toHaveBeenCalledTimes(1)
    expect(b.controls.pause).toHaveBeenCalledTimes(1)
    expect(captured.at(-1)?.event.kind).toBe("snapshot")
  })

  it("resume-all calls resume on every active record", () => {
    const a = makeRecord(1)
    const b = makeRecord(2)
    const { hook } = makeHook([a.record, b.record])
    handleCommand({ kind: "resume-all" }, new Map(), hook)
    expect(a.controls.resume).toHaveBeenCalledTimes(1)
    expect(b.controls.resume).toHaveBeenCalledTimes(1)
  })

  it("pause/resume/cancel/seek dispatch against byId, not listActive", () => {
    const target = makeRecord(42)
    const stale = makeRecord(7)
    const byId = new Map<number, AnimationRecordLike>([[42, target.record]])
    const { hook } = makeHook([stale.record])

    handleCommand({ kind: "pause", id: 42 }, byId, hook)
    handleCommand({ kind: "resume", id: 42 }, byId, hook)
    handleCommand({ kind: "seek", id: 42, progress: 0.6 }, byId, hook)
    handleCommand({ kind: "cancel", id: 42 }, byId, hook)

    expect(target.controls.pause).toHaveBeenCalledTimes(1)
    expect(target.controls.resume).toHaveBeenCalledTimes(1)
    expect(target.controls.seek).toHaveBeenCalledWith(0.6)
    expect(target.controls.cancel).toHaveBeenCalledTimes(1)
    expect(stale.controls.pause).not.toHaveBeenCalled()
  })

  it("targeted commands no-op silently when the id is missing", () => {
    const { hook } = makeHook([])
    expect(() => {
      handleCommand({ kind: "pause", id: 999 }, new Map(), hook)
      handleCommand({ kind: "resume", id: 999 }, new Map(), hook)
      handleCommand({ kind: "seek", id: 999, progress: 0.5 }, new Map(), hook)
      handleCommand({ kind: "cancel", id: 999 }, new Map(), hook)
    }).not.toThrow()
  })

  it("set-polling schedules an interval that emits snapshots", () => {
    vi.useFakeTimers()
    const { record } = makeRecord(1)
    const { hook } = makeHook([record])

    handleCommand({ kind: "set-polling", intervalMs: 100 }, new Map(), hook)
    expect(captured).toHaveLength(0)

    vi.advanceTimersByTime(250)
    expect(captured.filter((c) => c.event.kind === "snapshot")).toHaveLength(2)

    captured.length = 0
    handleCommand({ kind: "set-polling", intervalMs: 0 }, new Map(), hook)
    vi.advanceTimersByTime(500)
    expect(captured).toHaveLength(0)
  })
})
