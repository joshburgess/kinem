/**
 * Panel UI. Runs inside the Kinem DevTools panel iframe. Connects to
 * the background via a `kinem-panel` port, sends an `init` with the
 * inspected tab id, then renders incoming snapshot/start/finish/cancel
 * events.
 *
 * The panel is deliberately small: a status line, a table of active
 * animations with live progress bars, and two control rows (pause all
 * / resume all, per-row pause/resume/seek-to-zero/cancel). Recording
 * is a lightweight counter — every start/finish/cancel gets logged to
 * an in-memory buffer that the user can download as JSON.
 *
 * The UI avoids any framework on purpose. The panel lives inside an
 * iframe owned by Chrome; adding a React or Vue runtime would more
 * than double the bundle for a display that mostly renders a list.
 */

import {
  type AgentEvent,
  type AnimationSnapshot,
  PANEL_PORT,
  type PanelCommand,
  type RuntimeMessage,
} from "./shared/protocol"

interface RecordedLog {
  readonly at: number
  readonly kind: "start" | "finish" | "cancel"
  readonly id: number
  readonly snapshot?: AnimationSnapshot
}

const state = {
  animations: new Map<number, AnimationSnapshot>(),
  log: [] as RecordedLog[],
  recording: false,
  connected: false,
}

const port = chrome.runtime.connect({ name: PANEL_PORT })
port.postMessage({
  kind: "init",
  tabId: chrome.devtools.inspectedWindow.tabId,
} satisfies RuntimeMessage)

function send(command: PanelCommand): void {
  try {
    port.postMessage({ kind: "panel-command", command } satisfies RuntimeMessage)
  } catch {
    state.connected = false
    render()
  }
}

port.onMessage.addListener((message: RuntimeMessage) => {
  if (message.kind !== "agent-event") return
  apply(message.event)
})

port.onDisconnect.addListener(() => {
  state.connected = false
  render()
})

function apply(event: AgentEvent): void {
  if (event.kind === "hello") {
    state.connected = true
  } else if (event.kind === "snapshot") {
    state.animations = new Map(event.animations.map((a) => [a.id, a]))
  } else if (event.kind === "start") {
    state.animations.set(event.animation.id, event.animation)
    if (state.recording) {
      state.log.push({
        at: performance.now(),
        kind: "start",
        id: event.animation.id,
        snapshot: event.animation,
      })
    }
  } else if (event.kind === "finish" || event.kind === "cancel") {
    state.animations.delete(event.id)
    if (state.recording) state.log.push({ at: performance.now(), kind: event.kind, id: event.id })
  } else if (event.kind === "detached") {
    state.connected = false
    state.animations.clear()
  }
  render()
}

/* --- rendering ----------------------------------------------------- */

const root = document.getElementById("app")!
const statusEl = document.getElementById("status")!
const rowsEl = document.getElementById("rows")!
const pauseAllBtn = document.getElementById("pause-all") as HTMLButtonElement
const resumeAllBtn = document.getElementById("resume-all") as HTMLButtonElement
const refreshBtn = document.getElementById("refresh") as HTMLButtonElement
const recordBtn = document.getElementById("record") as HTMLButtonElement
const exportBtn = document.getElementById("export") as HTMLButtonElement
const clearLogBtn = document.getElementById("clear-log") as HTMLButtonElement
const recordCount = document.getElementById("record-count")!

pauseAllBtn.addEventListener("click", () => send({ kind: "pause-all" }))
resumeAllBtn.addEventListener("click", () => send({ kind: "resume-all" }))
refreshBtn.addEventListener("click", () => send({ kind: "request-snapshot" }))
recordBtn.addEventListener("click", () => {
  state.recording = !state.recording
  render()
})
clearLogBtn.addEventListener("click", () => {
  state.log = []
  render()
})
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.log, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `kinem-session-${Date.now()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})

function formatTarget(targets: AnimationSnapshot["targets"]): string {
  if (targets.length === 0) return "(no targets)"
  const first = targets[0]
  if (!first || first.kind !== "element") return "(unknown)"
  const tag = first.tag ?? "?"
  const id = first.id ? `#${first.id}` : ""
  const cls = first.classes && first.classes.length > 0 ? `.${first.classes.join(".")}` : ""
  const more = targets.length > 1 ? ` +${targets.length - 1}` : ""
  return `${tag}${id}${cls}${more}`
}

function isAmbientBackend(backend: string): boolean {
  return (
    backend === "follow" ||
    backend === "scroll" ||
    backend === "scrub" ||
    backend === "ambient"
  )
}

interface RowNodes {
  readonly row: HTMLElement
  readonly meta: HTMLElement
  readonly bar: HTMLElement
  ambient: boolean
  state: string
}
const rowNodes = new Map<number, RowNodes>()
let emptyEl: HTMLElement | null = null

function render(): void {
  root.dataset["connected"] = state.connected ? "yes" : "no"
  statusEl.textContent = state.connected
    ? `Connected · ${state.animations.size} animation${state.animations.size === 1 ? "" : "s"}`
    : "Waiting for kinem on this page…"

  recordBtn.textContent = state.recording ? "Stop recording" : "Start recording"
  recordBtn.classList.toggle("active", state.recording)
  recordCount.textContent = `${state.log.length} event${state.log.length === 1 ? "" : "s"}`
  exportBtn.disabled = state.log.length === 0
  clearLogBtn.disabled = state.log.length === 0

  const rows = Array.from(state.animations.values()).sort((a, b) => a.id - b.id)

  // Drop rows that are no longer active so the in-place updates below
  // don't reuse stale handles.
  const liveIds = new Set(rows.map((a) => a.id))
  for (const [id, nodes] of rowNodes) {
    if (!liveIds.has(id)) {
      nodes.row.remove()
      rowNodes.delete(id)
    }
  }

  if (rows.length === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement("div")
      emptyEl.className = "empty"
      rowsEl.appendChild(emptyEl)
    }
    emptyEl.textContent = state.connected
      ? "No active animations"
      : "Importing @kinem/devtools or calling enableTracker() in the page surfaces animations here."
    return
  }

  if (emptyEl) {
    emptyEl.remove()
    emptyEl = null
  }

  // Add or update rows in id order so the layout matches the sorted
  // active list. Updating in place (rather than rebuilding) preserves
  // CSS animation state, which the ambient stripe relies on.
  for (const a of rows) {
    const existing = rowNodes.get(a.id)
    if (existing) {
      updateRow(existing, a)
    } else {
      const created = renderRow(a)
      rowNodes.set(a.id, created)
      rowsEl.appendChild(created.row)
    }
  }
}

function renderRow(a: AnimationSnapshot): RowNodes {
  const row = document.createElement("div")
  row.className = `row state-${a.state}`

  const header = document.createElement("div")
  header.className = "row-header"
  const id = document.createElement("span")
  id.className = "row-id"
  id.textContent = `#${a.id}`
  const target = document.createElement("span")
  target.className = "row-target"
  target.textContent = formatTarget(a.targets)
  const meta = document.createElement("span")
  meta.className = "row-meta"
  header.append(id, target, meta)

  const track = document.createElement("div")
  track.className = "row-track"
  const bar = document.createElement("div")
  bar.className = "row-bar"
  track.appendChild(bar)

  const controls = document.createElement("div")
  controls.className = "row-controls"
  controls.append(
    btn("Pause", () => send({ kind: "pause", id: a.id })),
    btn("Resume", () => send({ kind: "resume", id: a.id })),
    btn("Seek 0", () => send({ kind: "seek", id: a.id, progress: 0 })),
    btn("Seek ½", () => send({ kind: "seek", id: a.id, progress: 0.5 })),
    btn("Seek 1", () => send({ kind: "seek", id: a.id, progress: 1 })),
    btn("Cancel", () => send({ kind: "cancel", id: a.id }), "danger"),
  )

  row.append(header, track, controls)
  const nodes: RowNodes = { row, meta, bar, ambient: false, state: a.state }
  updateRow(nodes, a)
  return nodes
}

function updateRow(nodes: RowNodes, a: AnimationSnapshot): void {
  if (nodes.state !== a.state) {
    nodes.row.className = `row state-${a.state}`
    nodes.state = a.state
  }
  nodes.meta.textContent = `${a.backend} · ${a.state} · ${Math.round(a.progress * 100)}%`

  const ambient = isAmbientBackend(a.backend)
  if (ambient !== nodes.ambient) {
    nodes.bar.classList.toggle("ambient", ambient)
    nodes.ambient = ambient
  }
  if (ambient) {
    if (nodes.bar.style.width !== "100%") nodes.bar.style.width = "100%"
  } else {
    const w = `${Math.round(a.progress * 100)}%`
    if (nodes.bar.style.width !== w) nodes.bar.style.width = w
  }
}

function btn(label: string, onClick: () => void, variant = ""): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.textContent = label
  if (variant) b.className = variant
  b.addEventListener("click", onClick)
  return b
}

/* --- live refresh -------------------------------------------------- */

// Ask the agent to stream a snapshot roughly 10 times per second while
// the panel is open. Cheap on the agent side (a single listActive loop
// + a postMessage) and keeps progress bars moving smoothly.
send({ kind: "set-polling", intervalMs: 100 })
send({ kind: "request-snapshot" })
render()
