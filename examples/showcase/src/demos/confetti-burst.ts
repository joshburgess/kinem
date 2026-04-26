import { easeOut, keyframes, playValues, spring } from "@kinem/core"
import type { Demo } from "../demo"

const PARTICLES_PER_BURST = 140
const COLORS = [
  "#fbbf24",
  "#f472b6",
  "#7c9cff",
  "#34d399",
  "#fb7185",
  "#a78bfa",
  "#22d3ee",
  "#f97316",
] as const

interface Particle {
  x: number
  y: number
  rot: number
  size: number
  color: string
  shape: "rect" | "ribbon"
  alive: boolean
}

interface Ring {
  cx: number
  cy: number
  r: number
  opacity: number
  alive: boolean
}

export const confettiBurst: Demo = {
  id: "confetti-burst",
  title: "Confetti burst",
  blurb:
    "Click anywhere. Each particle's lifecycle is a kinem tween (parabolic position, rotation, fade). A spring-driven shockwave ring also emanates from the click.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background: "radial-gradient(ellipse at 50% 50%, #0d0a1f 0%, #07080b 70%)",
      cursor: "pointer",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const hint = document.createElement("div")
    hint.textContent = "click anywhere to celebrate"
    Object.assign(hint.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      color: "rgba(232,236,244,0.55)",
      fontSize: "14px",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      pointerEvents: "none",
      fontWeight: "600",
      transition: "opacity 600ms",
    })
    wrap.appendChild(hint)

    const canvas = document.createElement("canvas")
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    })
    wrap.appendChild(canvas)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ctx = canvas.getContext("2d")
    if (!ctx) return () => {}

    const resize = (): void => {
      canvas.width = stage.clientWidth * dpr
      canvas.height = stage.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const particles: Particle[] = []
    const rings: Ring[] = []

    const draw = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Rings under particles
      for (const ring of rings) {
        if (!ring.alive) continue
        ctx.strokeStyle = `rgba(255,255,255,${ring.opacity * 0.6})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(ring.cx, ring.cy, ring.r, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (const p of particles) {
        if (!p.alive) continue
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3)
        }
        ctx.restore()
      }

      rafId = requestAnimationFrame(draw)
    }
    let rafId = requestAnimationFrame(draw)

    const burst = (cx: number, cy: number): void => {
      hint.style.opacity = "0"

      // Particles
      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 280 + Math.random() * 540
        const vx = Math.cos(angle) * speed
        const vy = Math.sin(angle) * speed - 220
        const lifeMs = 1700 + Math.random() * 1100
        const lifeSec = lifeMs / 1000
        const gravity = 1500
        const drag = 0.4 + Math.random() * 0.3
        const targetX = cx + vx * lifeSec * (1 - drag)
        const targetY = cy + vy * lifeSec * (1 - drag) + 0.5 * gravity * lifeSec * lifeSec
        const peakX = (cx + targetX) / 2 + (Math.random() - 0.5) * 60
        const peakY = cy + vy * 0.4 - 60
        const startRot = Math.random() * Math.PI * 2
        const endRot = startRot + (Math.random() - 0.5) * 16
        const size = 6 + Math.random() * 8
        const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#fff"
        const shape: Particle["shape"] = Math.random() < 0.4 ? "ribbon" : "rect"

        const p: Particle = {
          x: cx,
          y: cy,
          rot: startRot,
          size,
          color,
          shape,
          alive: true,
        }
        particles.push(p)

        playValues(
          keyframes(
            {
              x: [cx, peakX, targetX],
              y: [cy, peakY, targetY],
              rot: [startRot, startRot + (endRot - startRot) * 0.5, endRot],
              op: [1, 1, 0],
            },
            { duration: lifeMs, easing: easeOut, offsets: [0, 0.4, 1] },
          ),
          (v) => {
            p.x = v.x
            p.y = v.y
            p.rot = v.rot
            p.color = withAlpha(color, v.op)
          },
          {
            onFinish: () => {
              p.alive = false
            },
          },
        )
      }

      // Shockwave ring
      const ring: Ring = { cx, cy, r: 0, opacity: 1, alive: true }
      rings.push(ring)
      playValues(
        spring({ r: [0, 240], op: [1, 0] }, { stiffness: 80, damping: 16 }),
        (v) => {
          ring.r = v.r
          ring.opacity = v.op
        },
        {
          onFinish: () => {
            ring.alive = false
          },
        },
      )
    }

    const onPointerDown = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      burst(e.clientX - r.left, e.clientY - r.top)
    }
    wrap.addEventListener("pointerdown", onPointerDown)

    return () => {
      cancelAnimationFrame(rafId)
      wrap.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("resize", resize)
    }
  },
}

function withAlpha(hex: string, a: number): string {
  // Expects #rrggbb
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
