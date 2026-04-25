/**
 * Page-world agent. Runs in MAIN world so it can see the page's
 * bundled `@kinem/core` via the `__KINEM_DEVTOOLS_HOOK__` global the
 * tracker installs on `enableTracker()`.
 *
 * On load, the agent polls briefly for the hook (the page's core
 * bundle may not have run yet). Once connected, it subscribes to
 * tracker events, snapshots the active list on a slow timer while the
 * panel is open, and relays everything out via `window.postMessage`.
 * A matching listener on the same window accepts `PanelCommand`
 * envelopes from the ISOLATED-world content script and dispatches
 * against the live `Controls` references — which exist only here, in
 * the page world.
 *
 * There's intentionally no state beyond the hook subscription. If the
 * page navigates, the script reloads; if the panel closes, the content
 * script drops its runtime port and we keep running but nobody
 * listens, which is cheap.
 */

import {
  AGENT_SOURCE,
  type AgentEnvelope,
  type AgentEvent,
  type AnimationSnapshot,
  PANEL_SOURCE,
  type PanelCommand,
  type PanelEnvelope,
  type TargetDescriptor,
} from "./shared/protocol"

interface AnimationRecordLike {
  readonly id: number
  readonly duration: number
  readonly state: string
  readonly progress: number
  readonly startedAt: number
  readonly backend: string
  readonly targets: ReadonlyArray<unknown>
  readonly controls: {
    pause(): void
    resume(): void
    cancel(): void
    seek(progress: number): void
  }
}

interface HookLike {
  readonly version: number
  listActive(): ReadonlyArray<AnimationRecordLike>
  subscribe(
    fn: (
      event:
        | { readonly type: "start"; readonly id: number; readonly record: AnimationRecordLike }
        | { readonly type: "finish"; readonly id: number }
        | { readonly type: "cancel"; readonly id: number },
    ) => void,
  ): () => void
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

function toSnapshot(rec: AnimationRecordLike): AnimationSnapshot {
  return {
    id: rec.id,
    duration: rec.duration,
    state: rec.state,
    progress: rec.progress,
    startedAt: rec.startedAt,
    backend: rec.backend,
    targets: rec.targets.map(describeTarget),
  }
}

function post(event: AgentEvent): void {
  const envelope: AgentEnvelope = { source: AGENT_SOURCE, event }
  window.postMessage(envelope, "*")
}

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function connect(hook: HookLike, byId: Map<number, AnimationRecordLike>): void {
  for (const rec of hook.listActive()) byId.set(rec.id, rec)

  post({ kind: "hello", hookVersion: hook.version })
  post({
    kind: "snapshot",
    capturedAt: now(),
    animations: hook.listActive().map(toSnapshot),
  })

  hook.subscribe((event) => {
    if (event.type === "start") {
      byId.set(event.id, event.record)
      post({ kind: "start", animation: toSnapshot(event.record) })
    } else if (event.type === "finish") {
      byId.delete(event.id)
      post({ kind: "finish", id: event.id })
    } else {
      byId.delete(event.id)
      post({ kind: "cancel", id: event.id })
    }
  })
}

function handleCommand(
  command: PanelCommand,
  byId: Map<number, AnimationRecordLike>,
  hook: HookLike,
): void {
  const sync = (): void => {
    post({
      kind: "snapshot",
      capturedAt: now(),
      animations: hook.listActive().map(toSnapshot),
    })
  }
  switch (command.kind) {
    case "ping":
      post({ kind: "hello", hookVersion: hook.version })
      sync()
      return
    case "request-snapshot":
      sync()
      return
    case "pause-all":
      for (const rec of hook.listActive()) rec.controls.pause()
      sync()
      return
    case "resume-all":
      for (const rec of hook.listActive()) rec.controls.resume()
      sync()
      return
    case "pause":
      byId.get(command.id)?.controls.pause()
      sync()
      return
    case "resume":
      byId.get(command.id)?.controls.resume()
      sync()
      return
    case "seek":
      byId.get(command.id)?.controls.seek(command.progress)
      sync()
      return
    case "cancel":
      byId.get(command.id)?.controls.cancel()
      sync()
      return
    case "set-polling":
      setPollingInterval(command.intervalMs, hook)
      return
  }
}

let pollTimer: number | null = null

function setPollingInterval(intervalMs: number, hook: HookLike): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (intervalMs <= 0) return
  pollTimer = window.setInterval(() => {
    post({
      kind: "snapshot",
      capturedAt: now(),
      animations: hook.listActive().map(toSnapshot),
    })
  }, intervalMs)
}

function waitForHook(max: number, interval: number): Promise<HookLike | null> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = (): void => {
      const g = globalThis as { __KINEM_DEVTOOLS_HOOK__?: HookLike }
      if (g.__KINEM_DEVTOOLS_HOOK__) {
        resolve(g.__KINEM_DEVTOOLS_HOOK__)
        return
      }
      if (Date.now() - start > max) {
        resolve(null)
        return
      }
      setTimeout(check, interval)
    }
    check()
  })
}

async function boot(): Promise<void> {
  const hook = await waitForHook(30_000, 250)
  if (!hook) return
  const byId = new Map<number, AnimationRecordLike>()
  connect(hook, byId)

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    const data = event.data as PanelEnvelope | null
    if (!data || typeof data !== "object" || data.source !== PANEL_SOURCE) return
    handleCommand(data.command, byId, hook)
  })
}

void boot()
