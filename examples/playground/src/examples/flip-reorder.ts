import { easeOut, play, tween } from "@kinem/core"
import type { Example } from "../example"

interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

const PALETTE = [
  "#7c9cff",
  "#ff7c9c",
  "#9cff7c",
  "#ffce7c",
  "#ce7cff",
  "#7cffce",
  "#ff9c7c",
  "#7cceff",
]

export const flipReorder: Example = {
  id: "flip-reorder",
  title: "FLIP reorder",
  description: "Click any tile to send it to the front. The grid re-flows with FLIP.",
  tall: true,
  mount(stage) {
    stage.style.display = "grid"
    stage.style.gridTemplateColumns = "repeat(4, 1fr)"
    stage.style.gridAutoRows = "1fr"
    stage.style.gap = "8px"
    stage.style.padding = "12px"

    const items = PALETTE.map((color, i) => ({ id: i, color }))
    const tileEls = new Map<number, HTMLElement>()
    const prevRects = new Map<number, Rect>()
    const activeControls = new Map<number, ReturnType<typeof play>>()

    const render = (): void => {
      // First: capture current rects
      for (const item of items) {
        const el = tileEls.get(item.id)
        if (el) prevRects.set(item.id, readRect(el))
      }

      // Reorder DOM
      for (const item of items) {
        const el = tileEls.get(item.id)
        if (el) stage.appendChild(el)
      }

      // Last + Invert + Play for each tile that moved
      for (const item of items) {
        const el = tileEls.get(item.id)
        const prev = prevRects.get(item.id)
        if (!el || !prev) continue
        const next = readRect(el)
        const dx = prev.left - next.left
        const dy = prev.top - next.top
        if (dx === 0 && dy === 0) continue

        const existing = activeControls.get(item.id)
        if (existing && existing.state !== "finished" && existing.state !== "cancelled") {
          existing.cancel()
        }

        const c = play(tween({ x: [dx, 0], y: [dy, 0] }, { duration: 380, easing: easeOut }), el)
        activeControls.set(item.id, c)
      }
    }

    for (const item of items) {
      const el = document.createElement("button")
      el.type = "button"
      el.style.background = item.color
      el.style.border = "none"
      el.style.borderRadius = "8px"
      el.style.cursor = "pointer"
      el.style.minHeight = "48px"
      el.textContent = String(item.id + 1)
      el.style.color = "#0f1117"
      el.style.font = "600 16px system-ui"
      el.addEventListener("click", () => {
        const idx = items.findIndex((i) => i.id === item.id)
        if (idx <= 0) return
        items.splice(idx, 1)
        items.unshift(item)
        render()
      })
      tileEls.set(item.id, el)
      stage.appendChild(el)
    }

    let shuffleTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      // periodically shuffle to demo the effect even without clicks
      const i = 1 + Math.floor(Math.random() * (items.length - 1))
      const j = Math.floor(Math.random() * items.length)
      if (i === j) return
      const [moved] = items.splice(i, 1)
      if (moved) items.splice(j, 0, moved)
      render()
    }, 2000)

    return () => {
      if (shuffleTimer) clearInterval(shuffleTimer)
      shuffleTimer = null
      for (const c of activeControls.values()) c.cancel()
      activeControls.clear()
    }
  },
}
