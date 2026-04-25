import { keyframes, playStagger } from "@kinem/core"
import type { Demo } from "../demo"

const COLS = 14
const ROWS = 10
const TILE_GAP = 6

export const cascadeGrid: Demo = {
  id: "cascade-grid",
  title: "Cascade · stagger from click",
  blurb:
    "Click anywhere in the grid. A scale + glow wave radiates outward, ordered by distance to the click. Built on `playStagger` with a custom `from` function.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 40%, #1a1230 0%, #07080b 70%), radial-gradient(ellipse at 80% 80%, #1d2347 0%, transparent 60%)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const hint = document.createElement("div")
    hint.textContent = "click any tile"
    Object.assign(hint.style, {
      position: "absolute",
      bottom: "32px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(232,236,244,0.55)",
      fontSize: "12px",
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      pointerEvents: "none",
      fontWeight: "600",
    })
    wrap.appendChild(hint)

    const grid = document.createElement("div")
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: `repeat(${COLS}, 1fr)`,
      gridTemplateRows: `repeat(${ROWS}, 1fr)`,
      gap: `${TILE_GAP}px`,
      width: "min(82vw, 880px)",
      aspectRatio: `${COLS} / ${ROWS}`,
      padding: "12px",
    })
    wrap.appendChild(grid)

    interface Tile {
      el: HTMLDivElement
      col: number
      row: number
    }

    const tiles: Tile[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = document.createElement("div")
        const t = (c + r) / (COLS + ROWS)
        const hue = 220 + t * 140
        Object.assign(el.style, {
          background: `hsl(${hue}, 75%, 60%)`,
          borderRadius: "10px",
          willChange: "transform, opacity",
          opacity: "0.55",
          transform: "scale(1)",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 14px hsla(${hue}, 75%, 50%, 0.25)`,
        })
        grid.appendChild(el)
        tiles.push({ el, col: c, row: r })
      }
    }

    let activeRun: ReturnType<typeof playStagger> | null = null

    const trigger = (e: PointerEvent): void => {
      const rect = grid.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const cellW = rect.width / COLS
      const cellH = rect.height / ROWS
      const clickCol = localX / cellW
      const clickRow = localY / cellH

      const orderFor = (i: number): number => {
        const t = tiles[i] as Tile
        const dx = t.col + 0.5 - clickCol
        const dy = t.row + 0.5 - clickRow
        return Math.hypot(dx, dy)
      }

      activeRun?.cancel()

      const wave = keyframes(
        {
          scale: [1, 1.4, 1],
          opacity: [0.55, 1, 0.55],
        },
        { duration: 520 },
      )

      activeRun = playStagger(wave, tiles.map((t) => t.el) as never, {
        each: 18,
        from: orderFor,
      })
    }

    wrap.addEventListener("pointerdown", trigger)

    // Auto-trigger at center to make the demo immediately legible.
    const auto = window.setTimeout(() => {
      const rect = grid.getBoundingClientRect()
      trigger({
        clientX: rect.left + rect.width * 0.32,
        clientY: rect.top + rect.height * 0.5,
      } as PointerEvent)
    }, 300)

    return () => {
      window.clearTimeout(auto)
      wrap.removeEventListener("pointerdown", trigger)
      activeRun?.cancel()
    }
  },
}
