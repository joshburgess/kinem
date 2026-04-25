import { follow } from "@kinem/core"
import type { Demo } from "../demo"

const N = 16

export const cometTrail: Demo = {
  id: "comet-trail",
  title: "Comet trail · follow chain",
  blurb:
    "Move the cursor. A chain of glowing orbs trails the head with per-link decay, so each one lags slightly more than the last. Built on the `follow` primitive.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 30%, #1a103a 0%, #07080b 70%), radial-gradient(ellipse at 30% 80%, #0f1d3a 0%, transparent 60%)",
      cursor: "crosshair",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const starField = document.createElement("div")
    Object.assign(starField.style, { position: "absolute", inset: "0", pointerEvents: "none" })
    wrap.appendChild(starField)
    for (let i = 0; i < 70; i++) {
      const s = document.createElement("div")
      const size = 1 + Math.random() * 2
      Object.assign(s.style, {
        position: "absolute",
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "rgba(232,236,244,0.55)",
        opacity: String(0.4 + Math.random() * 0.6),
      })
      starField.appendChild(s)
    }

    const orbs: HTMLDivElement[] = []
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      const size = 38 - t * 26
      const hue = 220 + t * 120
      const el = document.createElement("div")
      Object.assign(el.style, {
        position: "absolute",
        left: `${-size / 2}px`,
        top: `${-size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, hsl(${hue}, 95%, 80%), hsl(${hue}, 85%, 55%) 60%, transparent 70%)`,
        boxShadow: `0 0 ${size * 0.9}px hsla(${hue}, 95%, 70%, ${0.85 - t * 0.6})`,
        pointerEvents: "none",
        willChange: "transform",
        opacity: String(1 - t * 0.55),
      })
      wrap.appendChild(el)
      orbs.push(el)
    }

    const handle = follow(orbs, {
      stiffness: 0.42,
      decay: 0.86,
    })
    // Snap into the center of the wrap before the first rAF tick lands,
    // otherwise every orb commits at (0, 0) for one frame and flashes.
    handle.snapTo(wrap.clientWidth / 2, wrap.clientHeight / 2)

    let inside = false
    let mx = 0
    let my = 0

    const onMove = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      mx = e.clientX - r.left
      my = e.clientY - r.top
      if (!inside) {
        inside = true
        handle.snapTo(mx, my)
      }
      handle.setLeader(mx, my)
    }
    const onLeave = (): void => {
      inside = false
    }

    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    // Idle drift while the pointer isn't engaged.
    let rafId = 0
    const start = performance.now()
    const idle = (): void => {
      if (!inside) {
        const t = (performance.now() - start) / 1000
        const w = wrap.clientWidth
        const h = wrap.clientHeight
        const cx = w / 2 + Math.cos(t * 0.6) * (w * 0.32)
        const cy = h / 2 + Math.sin(t * 0.9) * (h * 0.28)
        handle.setLeader(cx, cy)
      }
      rafId = requestAnimationFrame(idle)
    }
    rafId = requestAnimationFrame(idle)

    return () => {
      cancelAnimationFrame(rafId)
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      handle.cancel()
    }
  },
}
