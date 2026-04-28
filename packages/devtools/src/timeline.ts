/**
 * Visual timeline scrubber. Each active animation is rendered as a
 * horizontal track bar, color-coded by rendering backend. A playhead
 * overlays all tracks. Dragging the playhead pauses every animation
 * and seeks each to the matching 0-to-1 position; releasing the drag
 * resumes them. A global play/pause button toggles every animation at
 * once.
 *
 *   const scrubber = mountTimeline()
 *   // ... later
 *   scrubber.unmount()
 *
 * This is the video-editor-style panel described in the 5.1 build
 * plan. Unlike the inspector overlay, which is an at-a-glance list,
 * the timeline is a control surface: it assumes the user wants to
 * interrogate timing, not just observe it.
 *
 * The scrubber lives in the same package as the inspector but is a
 * separate mount so pages can opt into either or both independently.
 */

import { type AnimationRecord, listActiveAnimations, subscribeTracker } from "@kinem/core"

export type TimelinePosition = "top" | "bottom"

export interface MountTimelineOpts {
  readonly position?: TimelinePosition
  readonly parent?: Element
  readonly collapsed?: boolean
}

export interface TimelineHandle {
  unmount(): void
  refresh(): void
  readonly element: HTMLElement
}

const STYLES = `
  :host { all: initial; }
  .panel {
    position: fixed;
    left: 12px;
    right: 12px;
    z-index: 2147483646;
    font: 12px/1.4 system-ui, -apple-system, sans-serif;
    color: #e6e6e6;
    background: rgba(20, 20, 20, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    max-height: 40vh;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  .panel.top { top: 12px; }
  .panel.bottom { bottom: 12px; }
  .panel.collapsed .body { display: none; }
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    user-select: none;
  }
  .header .title { font-weight: 600; margin-right: auto; }
  .header button {
    all: unset;
    cursor: pointer;
    color: #aaa;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .header button:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
  .header button.active { color: #fff; background: rgba(63, 185, 80, 0.2); border-color: #3fb950; }
  .body { max-height: calc(40vh - 36px); overflow-y: auto; padding: 4px 0; }
  .empty { padding: 16px; text-align: center; color: #888; }
  .rows-wrap { position: relative; }
  .track-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 8px;
    align-items: center;
    padding: 4px 10px;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #8ab4ff;
    font-variant-numeric: tabular-nums;
  }
  .label .id { color: #888; margin-right: 6px; }
  .lane {
    position: relative;
    height: 14px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    background: #3fb950;
    opacity: 0.45;
  }
  .bar.waapi { background: #3fb950; }
  .bar.raf { background: #d29922; }
  .bar.auto { background: #8ab4ff; }
  .bar.ambient {
    background: repeating-linear-gradient(
      45deg,
      rgba(167, 139, 250, 0.55) 0 6px,
      rgba(167, 139, 250, 0.22) 6px 12px
    );
    background-size: 17px 17px;
    opacity: 0.85;
    animation: kinem-ambient-stripe 1.1s linear infinite;
  }
  @keyframes kinem-ambient-stripe {
    from { background-position: 0 0; }
    to   { background-position: 17px 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bar.ambient { animation: none; }
  }
  .progress {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: #fff;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #ff5d5d;
    pointer-events: none;
    transform: translateX(-1px);
  }
  .playhead-hit {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 140px;
    right: 10px;
    cursor: ew-resize;
  }
`

function targetLabel(record: AnimationRecord): string {
  const first = record.targets[0] as
    | { tagName?: string; id?: string; className?: string }
    | undefined
  if (!first) return "(no targets)"
  if (typeof first.tagName !== "string") return "(unknown)"
  const tag = first.tagName.toLowerCase()
  const id = typeof first.id === "string" && first.id.length > 0 ? `#${first.id}` : ""
  const more = record.targets.length > 1 ? ` +${record.targets.length - 1}` : ""
  return `${tag}${id}${more}`
}

function backendClass(backend: string): string {
  if (backend === "waapi") return "bar waapi"
  if (backend === "raf") return "bar raf"
  if (backend === "follow" || backend === "scrub" || backend === "scroll" || backend === "ambient")
    return "bar ambient"
  return "bar auto"
}

export function mountTimeline(opts: MountTimelineOpts = {}): TimelineHandle {
  if (typeof document === "undefined") {
    throw new Error("mountTimeline(): requires a DOM environment")
  }
  const parent = opts.parent ?? document.body
  const position: TimelinePosition = opts.position ?? "bottom"

  const host = document.createElement("div")
  host.setAttribute("data-kinem-timeline", "")
  const shadow = host.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = STYLES
  shadow.appendChild(style)

  const panel = document.createElement("div")
  panel.className = `panel ${position}${opts.collapsed ? " collapsed" : ""}`
  shadow.appendChild(panel)

  const header = document.createElement("div")
  header.className = "header"
  const title = document.createElement("span")
  title.className = "title"
  title.textContent = "Timeline"
  header.appendChild(title)

  const pauseBtn = document.createElement("button")
  pauseBtn.type = "button"
  pauseBtn.textContent = "Pause all"
  header.appendChild(pauseBtn)

  const resumeBtn = document.createElement("button")
  resumeBtn.type = "button"
  resumeBtn.textContent = "Resume all"
  header.appendChild(resumeBtn)

  const toggle = document.createElement("button")
  toggle.type = "button"
  toggle.textContent = opts.collapsed ? "+" : "-"
  header.appendChild(toggle)
  panel.appendChild(header)

  const body = document.createElement("div")
  body.className = "body"
  panel.appendChild(body)

  const rowsWrap = document.createElement("div")
  rowsWrap.className = "rows-wrap"
  body.appendChild(rowsWrap)

  const playhead = document.createElement("div")
  playhead.className = "playhead"
  playhead.style.display = "none"
  rowsWrap.appendChild(playhead)

  let unmounted = false
  let rafId: number | null = null
  let scrubbing = false
  let scrubPos = 0

  interface RowNodes {
    readonly row: HTMLElement
    readonly bar: HTMLElement
    readonly progress: HTMLElement
    backend: string
  }
  const rowNodes = new Map<number, RowNodes>()
  let emptyEl: HTMLElement | null = null

  toggle.addEventListener("click", () => {
    panel.classList.toggle("collapsed")
    toggle.textContent = panel.classList.contains("collapsed") ? "+" : "-"
  })

  pauseBtn.addEventListener("click", () => {
    for (const rec of listActiveAnimations()) rec.controls.pause()
    render()
  })

  resumeBtn.addEventListener("click", () => {
    for (const rec of listActiveAnimations()) rec.controls.resume()
    kick()
  })

  const render = (): void => {
    const records = listActiveAnimations()
    const liveIds = new Set(records.map((r) => r.id))

    // Drop rows whose record is gone so the in-place updates below
    // don't leak dead entries.
    for (const [id, nodes] of rowNodes) {
      if (!liveIds.has(id)) {
        nodes.row.remove()
        rowNodes.delete(id)
      }
    }

    if (records.length === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement("div")
        emptyEl.className = "empty"
        emptyEl.textContent = "No active animations"
        rowsWrap.appendChild(emptyEl)
      }
      playhead.style.display = "none"
      return
    }

    if (emptyEl) {
      emptyEl.remove()
      emptyEl = null
    }

    // Add or update rows in record order. Updating in place (rather than
    // rebuilding every tick) preserves CSS animation state, which the
    // ambient stripe relies on for its visible motion.
    let prev: HTMLElement | null = null
    for (const rec of records) {
      const existing = rowNodes.get(rec.id)
      const nodes = existing ?? createRow(rec)
      if (!existing) {
        rowNodes.set(rec.id, nodes)
        if (prev) {
          prev.after(nodes.row)
        } else {
          rowsWrap.insertBefore(nodes.row, rowsWrap.firstChild)
        }
      }
      updateRow(nodes, rec)
      prev = nodes.row
    }

    // The playhead and hit zone always live at the end of rowsWrap so
    // they overlay the rows and capture pointer events on top.
    rowsWrap.appendChild(playhead)
    rowsWrap.appendChild(hitZone)

    playhead.style.display = scrubbing ? "block" : "none"
    if (scrubbing) positionPlayhead(scrubPos)
  }

  const createRow = (rec: AnimationRecord): RowNodes => {
    const row = document.createElement("div")
    row.className = "track-row"
    row.setAttribute("data-id", String(rec.id))

    const label = document.createElement("div")
    label.className = "label"
    const idSpan = document.createElement("span")
    idSpan.className = "id"
    idSpan.textContent = `#${rec.id}`
    label.appendChild(idSpan)
    const targetSpan = document.createElement("span")
    targetSpan.textContent = targetLabel(rec)
    label.appendChild(targetSpan)
    row.appendChild(label)

    const lane = document.createElement("div")
    lane.className = "lane"
    const bar = document.createElement("div")
    bar.className = backendClass(rec.backend)
    bar.style.width = "100%"
    lane.appendChild(bar)

    const progress = document.createElement("div")
    progress.className = "progress"
    lane.appendChild(progress)
    row.appendChild(lane)

    return { row, bar, progress, backend: rec.backend }
  }

  const updateRow = (nodes: RowNodes, rec: AnimationRecord): void => {
    if (nodes.backend !== rec.backend) {
      nodes.bar.className = backendClass(rec.backend)
      nodes.backend = rec.backend
    }
    const left = `${Math.round(rec.progress * 100)}%`
    if (nodes.progress.style.left !== left) {
      nodes.progress.style.left = left
    }
  }

  const positionPlayhead = (ratio: number): void => {
    const lanes = rowsWrap.querySelectorAll(".lane")
    const firstLane = lanes[0] as HTMLElement | undefined
    if (!firstLane) return
    const wrapRect = rowsWrap.getBoundingClientRect()
    const laneRect = firstLane.getBoundingClientRect()
    const x = laneRect.left - wrapRect.left + ratio * laneRect.width
    playhead.style.left = `${x}px`
  }

  const tick = (): void => {
    if (unmounted) return
    render()
    const records = listActiveAnimations()
    const anyPlaying = records.some((r) => r.state === "playing")
    if (anyPlaying && typeof requestAnimationFrame !== "undefined") {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = null
    }
  }

  const kick = (): void => {
    if (unmounted) return
    if (rafId !== null) return
    if (typeof requestAnimationFrame !== "undefined") {
      rafId = requestAnimationFrame(tick)
    } else {
      render()
    }
  }

  const onPointerDown = (event: PointerEvent): void => {
    const records = listActiveAnimations()
    if (records.length === 0) return
    scrubbing = true
    for (const rec of records) rec.controls.pause()
    updateScrub(event)
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!scrubbing) return
    updateScrub(event)
  }

  const onPointerUp = (): void => {
    if (!scrubbing) return
    scrubbing = false
    render()
  }

  const updateScrub = (event: PointerEvent): void => {
    const firstLane = rowsWrap.querySelector(".lane") as HTMLElement | null
    if (!firstLane) return
    const rect = firstLane.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    scrubPos = ratio
    for (const rec of listActiveAnimations()) rec.controls.seek(ratio)
    render()
  }

  const hitZone = document.createElement("div")
  hitZone.className = "playhead-hit"
  hitZone.addEventListener("pointerdown", (e) => {
    hitZone.setPointerCapture(e.pointerId)
    onPointerDown(e)
  })
  hitZone.addEventListener("pointermove", onPointerMove)
  hitZone.addEventListener("pointerup", (e) => {
    hitZone.releasePointerCapture(e.pointerId)
    onPointerUp()
  })
  hitZone.addEventListener("pointercancel", onPointerUp)
  rowsWrap.appendChild(hitZone)

  const unsubscribe = subscribeTracker((event) => {
    if (unmounted) return
    if (event.type === "start") kick()
    else render()
  })

  parent.appendChild(host)
  render()

  return {
    unmount() {
      if (unmounted) return
      unmounted = true
      unsubscribe()
      if (rafId !== null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(rafId)
      }
      host.remove()
    },
    refresh() {
      render()
    },
    element: host,
  }
}
