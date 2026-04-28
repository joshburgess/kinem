import { playValues } from "@kinem/core"
import type { Demo } from "../demo"

const TICK_PERIOD = 60_000

interface Particle {
  homeX: number
  homeY: number
  x: number
  y: number
  vx: number
  vy: number
  hue: number
}

const SPRING_K = 0.05
const DAMPING = 0.85
const REPEL_R = 140
const REPEL_R_SQ = REPEL_R * REPEL_R
const REPEL_STRENGTH = 3200

export const particleField: Demo = {
  id: "particle-field",
  title: "Cursor-reactive particle field",
  blurb:
    "A spring lattice of ~3k particles. Your cursor pushes them; a rest force pulls them home. Uses Canvas 2D.",
  group: "Showcase",
  mount(stage) {
    const canvas = document.createElement("canvas")
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      background: "#07080b",
      cursor: "crosshair",
    })
    stage.appendChild(canvas)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return () => {}

    let w = 0
    let h = 0
    const particles: Particle[] = []

    const rebuild = (): void => {
      w = stage.clientWidth
      h = stage.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      particles.length = 0
      const spacing = 18
      const cols = Math.floor(w / spacing)
      const rows = Math.floor(h / spacing)
      const offX = (w - cols * spacing) / 2 + spacing / 2
      const offY = (h - rows * spacing) / 2 + spacing / 2
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = offX + col * spacing
          const y = offY + row * spacing
          particles.push({
            homeX: x,
            homeY: y,
            x,
            y,
            vx: 0,
            vy: 0,
            hue: 200 + (col / cols) * 140,
          })
        }
      }
    }
    rebuild()

    const onResize = (): void => rebuild()
    window.addEventListener("resize", onResize)

    let mx = -9999
    let my = -9999
    let inside = false
    const onMove = (e: PointerEvent): void => {
      const r = canvas.getBoundingClientRect()
      mx = e.clientX - r.left
      my = e.clientY - r.top
      inside = true
    }
    const onLeave = (): void => {
      inside = false
    }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)

    const startedAt = performance.now()
    // Drive the canvas tick through playValues so it shows up in the
    // devtools panel. The lattice is otherwise pure rAF and the panel
    // had no signal that anything was happening.
    const handle = playValues(
      { duration: TICK_PERIOD, interpolate: (p) => p },
      () => {
        ctx.fillStyle = "rgba(7, 8, 11, 0.18)"
        ctx.fillRect(0, 0, w, h)

        // When the cursor isn't engaged, drive a slow Lissajous "ghost"
        // pointer so the lattice always has visible motion. Without
        // this the demo looks frozen until the user mouses in.
        let fx = mx
        let fy = my
        let active = inside
        if (!inside) {
          const t = (performance.now() - startedAt) / 1000
          fx = w / 2 + Math.cos(t * 0.45) * (w * 0.32)
          fy = h / 2 + Math.sin(t * 0.7) * (h * 0.28)
          active = true
        }

        for (const p of particles) {
          p.vx += (p.homeX - p.x) * SPRING_K
          p.vy += (p.homeY - p.y) * SPRING_K

          if (active) {
            const dx = p.x - fx
            const dy = p.y - fy
            const d2 = dx * dx + dy * dy
            if (d2 < REPEL_R_SQ && d2 > 0.0001) {
              const d = Math.sqrt(d2)
              const force = REPEL_STRENGTH / d2
              p.vx += (dx / d) * force
              p.vy += (dy / d) * force
            }
          }

          p.vx *= DAMPING
          p.vy *= DAMPING
          p.x += p.vx
          p.y += p.vy

          const displaced = Math.hypot(p.x - p.homeX, p.y - p.homeY)
          const intensity = Math.min(1, displaced / 80)
          const size = 1.2 + intensity * 2.4
          const alpha = 0.5 + intensity * 0.5
          ctx.fillStyle = `hsla(${p.hue}, 85%, ${55 + intensity * 20}%, ${alpha})`
          ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size)
        }
      },
      { repeat: true },
    )

    return () => {
      handle.cancel()
      window.removeEventListener("resize", onResize)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
    }
  },
}
