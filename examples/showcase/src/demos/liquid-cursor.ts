import { playValues } from "@kinem/core"
import type { Demo } from "../demo"

const TICK_PERIOD = 60_000

const N = 14
const HEAD_R = 44
const FOLLOW_DECAY = 0.78
const HEAD_LERP = 0.32
const CHAIN_LERP = 0.35

const COLORS = [
  "#7c9cff",
  "#a78bfa",
  "#f472b6",
  "#fb7185",
  "#fbbf24",
  "#34d399",
  "#22d3ee",
  "#a78bfa",
] as const

interface Blob {
  el: HTMLDivElement
  x: number
  y: number
  r: number
}

export const liquidCursor: Demo = {
  id: "liquid-cursor",
  title: "Liquid metaball cursor",
  blurb:
    "A chain of soft blobs follows the cursor. The CSS goo trick (heavy blur + extreme contrast) blends them into a single fluid shape.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background: "#07080b",
      cursor: "crosshair",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    // The goo trick: blur the children heavily, then crank contrast so
    // anti-aliased edges binarize into one continuous shape. Children
    // are bright opaque circles; the dark background drops to black.
    const goo = document.createElement("div")
    Object.assign(goo.style, {
      position: "absolute",
      inset: "0",
      filter: "blur(14px) contrast(28)",
      background: "#07080b",
    })
    wrap.appendChild(goo)

    // Subtle ambient gradient under the goo for color
    const ambient = document.createElement("div")
    Object.assign(ambient.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 30% 70%, rgba(124,156,255,0.08), transparent 60%), radial-gradient(ellipse at 75% 25%, rgba(244,114,182,0.08), transparent 60%)",
      pointerEvents: "none",
    })
    wrap.appendChild(ambient)

    const blobs: Blob[] = []
    for (let i = 0; i < N; i++) {
      const r = HEAD_R * FOLLOW_DECAY ** i + 8
      const el = document.createElement("div")
      Object.assign(el.style, {
        position: "absolute",
        width: `${r * 2}px`,
        height: `${r * 2}px`,
        borderRadius: "50%",
        background: COLORS[i % COLORS.length],
        transform: "translate(-9999px, -9999px)",
        willChange: "transform",
      })
      goo.appendChild(el)
      blobs.push({ el, x: -9999, y: -9999, r })
    }

    let mx = -9999
    let my = -9999
    let inside = false

    const onMove = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      mx = e.clientX - r.left
      my = e.clientY - r.top
      if (!inside) {
        inside = true
        for (const b of blobs) {
          b.x = mx
          b.y = my
        }
      }
    }
    const onLeave = (): void => {
      inside = false
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    // Drive through playValues with a long symbolic period and repeat
    // so the chain renders as a single tracked entry in devtools. The
    // value bag is unused; the callback owns its own time integration.
    let drift = 0
    const handle = playValues(
      { duration: TICK_PERIOD, interpolate: (p) => p },
      () => {
        drift += 0.012
        const head = blobs[0]
        if (head) {
          const targetX = inside ? mx : wrap.clientWidth / 2 + Math.cos(drift) * 80
          const targetY = inside ? my : wrap.clientHeight / 2 + Math.sin(drift * 1.3) * 60
          head.x += (targetX - head.x) * HEAD_LERP
          head.y += (targetY - head.y) * HEAD_LERP
          head.el.style.transform = `translate(${head.x - head.r}px, ${head.y - head.r}px)`
        }
        for (let i = 1; i < N; i++) {
          const prev = blobs[i - 1]
          const cur = blobs[i]
          if (!prev || !cur) continue
          cur.x += (prev.x - cur.x) * CHAIN_LERP
          cur.y += (prev.y - cur.y) * CHAIN_LERP
          cur.el.style.transform = `translate(${cur.x - cur.r}px, ${cur.y - cur.r}px)`
        }
      },
      { repeat: true },
    )

    return () => {
      handle.cancel()
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
    }
  },
}
