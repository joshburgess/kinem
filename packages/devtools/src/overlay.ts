/**
 * In-page inspector overlay. Mounts a floating panel that lists every
 * active animation with live progress. Uses a shadow root so page CSS
 * cannot bleed in. The overlay subscribes to the tracker for create
 * and finish events, and runs a rAF loop to update progress bars
 * while anything is playing (bails out when idle).
 *
 *   const panel = mountInspector()
 *   // ... later
 *   panel.unmount()
 *
 * The overlay is opt-in; importing this module has no side effects
 * until `mountInspector()` is called. This module assumes a DOM is
 * available; server-side consumers should guard their callsite.
 */

import { subscribeTracker } from "motif-animate"
import { type AnimationSnapshot, snapshot } from "./inspector"

export type OverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface MountInspectorOpts {
  readonly position?: OverlayPosition
  /** Parent element to mount the host into. Defaults to `document.body`. */
  readonly parent?: Element
  /** When true, renders in a collapsed state by default. */
  readonly collapsed?: boolean
}

export interface InspectorHandle {
  unmount(): void
  /** Force a re-render immediately. Normally called automatically. */
  refresh(): void
  readonly element: HTMLElement
}

const STYLES = `
  :host { all: initial; }
  .panel {
    position: fixed;
    z-index: 2147483647;
    font: 12px/1.4 system-ui, -apple-system, sans-serif;
    color: #e6e6e6;
    background: rgba(20, 20, 20, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    min-width: 240px;
    max-width: 360px;
    max-height: 60vh;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    user-select: none;
  }
  .panel.top-left { top: 12px; left: 12px; }
  .panel.top-right { top: 12px; right: 12px; }
  .panel.bottom-left { bottom: 12px; left: 12px; }
  .panel.bottom-right { bottom: 12px; right: 12px; }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-weight: 600;
  }
  .header button {
    all: unset;
    cursor: pointer;
    color: #aaa;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .header button:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
  .body { max-height: calc(60vh - 36px); overflow-y: auto; padding: 4px 0; }
  .empty { padding: 16px; text-align: center; color: #888; }
  .row {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .row:last-child { border-bottom: none; }
  .row .meta { display: flex; justify-content: space-between; gap: 8px; }
  .row .id { color: #888; font-variant-numeric: tabular-nums; }
  .row .target { color: #8ab4ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row .state { color: #aaa; font-variant-numeric: tabular-nums; }
  .track {
    position: relative;
    height: 3px;
    margin-top: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: #3fb950;
    border-radius: 2px;
    transition: width 80ms linear;
  }
  .bar.paused { background: #d29922; }
  .panel.collapsed .body { display: none; }
`

function targetLabel(targets: AnimationSnapshot["targets"]): string {
  if (targets.length === 0) return "(no targets)"
  const first = targets[0]
  if (!first) return "(no targets)"
  if (first.kind === "unknown") return "(unknown)"
  const tag = first.tag ?? "?"
  const id = first.id ? `#${first.id}` : ""
  const cls = first.classes && first.classes.length > 0 ? `.${first.classes.join(".")}` : ""
  const suffix = targets.length > 1 ? ` +${targets.length - 1}` : ""
  return `${tag}${id}${cls}${suffix}`
}

function renderRow(doc: Document, a: AnimationSnapshot): HTMLElement {
  const row = doc.createElement("div")
  row.className = "row"
  row.setAttribute("data-id", String(a.id))

  const meta = doc.createElement("div")
  meta.className = "meta"
  const left = doc.createElement("span")
  left.className = "target"
  left.textContent = targetLabel(a.targets)
  const right = doc.createElement("span")
  right.className = "state"
  right.textContent = `${a.state} ${Math.round(a.progress * 100)}%`
  meta.appendChild(left)
  meta.appendChild(right)

  const track = doc.createElement("div")
  track.className = "track"
  const bar = doc.createElement("div")
  bar.className = a.state === "paused" ? "bar paused" : "bar"
  bar.style.width = `${Math.round(a.progress * 100)}%`
  track.appendChild(bar)

  row.appendChild(meta)
  row.appendChild(track)
  return row
}

export function mountInspector(opts: MountInspectorOpts = {}): InspectorHandle {
  if (typeof document === "undefined") {
    throw new Error("mountInspector(): requires a DOM environment")
  }
  const parent = opts.parent ?? document.body
  const position: OverlayPosition = opts.position ?? "bottom-right"

  const host = document.createElement("div")
  host.setAttribute("data-motif-inspector", "")
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
  title.textContent = "Motif"
  const toggle = document.createElement("button")
  toggle.type = "button"
  toggle.textContent = opts.collapsed ? "+" : "-"
  toggle.addEventListener("click", () => {
    panel.classList.toggle("collapsed")
    toggle.textContent = panel.classList.contains("collapsed") ? "+" : "-"
  })
  header.appendChild(title)
  header.appendChild(toggle)
  panel.appendChild(header)

  const body = document.createElement("div")
  body.className = "body"
  panel.appendChild(body)

  let rafId: number | null = null
  let unmounted = false

  const render = (): void => {
    const snap = snapshot()
    body.textContent = ""
    if (snap.animations.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty"
      empty.textContent = "No active animations"
      body.appendChild(empty)
      return
    }
    for (const a of snap.animations) body.appendChild(renderRow(document, a))
  }

  const tick = (): void => {
    if (unmounted) return
    render()
    const snap = snapshot()
    if (snap.animations.length > 0 && typeof requestAnimationFrame !== "undefined") {
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
