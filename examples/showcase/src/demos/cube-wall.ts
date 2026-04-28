import { type ValuesHandle, easeInOut, playValues, tween } from "@kinem/core"
import type { Demo } from "../demo"

const COLS = 12
const ROWS = 8
const TILE_SIZE = 56
const FLIP_MS = 720

interface Tile {
  el: HTMLDivElement
  inner: HTMLDivElement
  col: number
  row: number
  rot: number
  busy: boolean
}

export const cubeWall: Demo = {
  id: "cube-wall",
  title: "Cube wall · staggered 3D flip",
  blurb:
    "Click any tile. A wave of CSS 3D flips radiates outward, ordered by distance from the click. Each tile drives its own `tween` from its current rotation to +180°, accumulating state across clicks.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 35%, #1a1235 0%, #07080b 70%), radial-gradient(ellipse at 80% 80%, #1d2247 0%, transparent 60%)",
      display: "grid",
      placeItems: "center",
      perspective: "1100px",
      cursor: "pointer",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const grid = document.createElement("div")
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
      gridTemplateRows: `repeat(${ROWS}, ${TILE_SIZE}px)`,
      gap: "8px",
      transformStyle: "preserve-3d",
    })
    wrap.appendChild(grid)

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

    const tiles: Tile[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div")
        Object.assign(cell.style, {
          width: `${TILE_SIZE}px`,
          height: `${TILE_SIZE}px`,
          perspective: "800px",
        })
        const inner = document.createElement("div")
        Object.assign(inner.style, {
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          willChange: "transform",
        })
        cell.appendChild(inner)

        const t = (c + r) / (COLS + ROWS)
        const hueA = 220 + t * 140
        const hueB = (hueA + 110) % 360

        const front = document.createElement("div")
        Object.assign(front.style, {
          position: "absolute",
          inset: "0",
          borderRadius: "8px",
          background: `linear-gradient(135deg, hsl(${hueA}, 75%, 62%) 0%, hsl(${(hueA + 30) % 360}, 75%, 50%) 100%)`,
          backfaceVisibility: "hidden",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 14px hsla(${hueA}, 75%, 50%, 0.25)`,
        })
        inner.appendChild(front)

        const back = document.createElement("div")
        Object.assign(back.style, {
          position: "absolute",
          inset: "0",
          borderRadius: "8px",
          background: `linear-gradient(135deg, hsl(${hueB}, 80%, 65%) 0%, hsl(${(hueB + 25) % 360}, 80%, 52%) 100%)`,
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 14px hsla(${hueB}, 80%, 50%, 0.28)`,
        })
        inner.appendChild(back)

        grid.appendChild(cell)
        tiles.push({ el: cell, inner, col: c, row: r, rot: 0, busy: false })
      }
    }

    const pendingTimeouts = new Set<number>()
    const liveHandles = new Set<ValuesHandle>()

    const flipTile = (tile: Tile, delay: number): void => {
      const id = window.setTimeout(() => {
        pendingTimeouts.delete(id)
        if (tile.busy) return
        tile.busy = true
        const startRot = tile.rot
        const endRot = startRot + 180
        const flipDef = tween({ r: [startRot, endRot] }, { duration: FLIP_MS, easing: easeInOut })
        const handle = playValues(
          flipDef,
          (v) => {
            tile.inner.style.transform = `rotateY(${v.r.toFixed(2)}deg)`
          },
          {
            onFinish: () => {
              tile.rot = endRot
              tile.busy = false
              liveHandles.delete(handle)
            },
          },
        )
        liveHandles.add(handle)
      }, delay)
      pendingTimeouts.add(id)
    }

    const trigger = (e: PointerEvent): void => {
      const rect = grid.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const cellW = rect.width / COLS
      const cellH = rect.height / ROWS
      const cc = localX / cellW
      const cr = localY / cellH

      for (const tile of tiles) {
        const dx = tile.col + 0.5 - cc
        const dy = tile.row + 0.5 - cr
        const d = Math.hypot(dx, dy)
        flipTile(tile, d * 32)
      }
    }

    wrap.addEventListener("pointerdown", trigger)

    const auto = window.setTimeout(() => {
      const rect = grid.getBoundingClientRect()
      trigger({
        clientX: rect.left + rect.width * 0.18,
        clientY: rect.top + rect.height * 0.5,
      } as PointerEvent)
    }, 350)

    return () => {
      window.clearTimeout(auto)
      for (const id of pendingTimeouts) window.clearTimeout(id)
      pendingTimeouts.clear()
      for (const h of liveHandles) h.cancel()
      liveHandles.clear()
      wrap.removeEventListener("pointerdown", trigger)
    }
  },
}
