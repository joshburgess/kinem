import { easeInOut, morphPath } from "@kinem/core"
import type { Demo } from "../demo"

interface ShapeDef {
  readonly id: string
  readonly label: string
  readonly d: string
  readonly hueA: number
  readonly hueB: number
}

const SHAPES: readonly ShapeDef[] = [
  {
    id: "drop",
    label: "Drop",
    d: "M 100 25 C 100 25 55 90 55 128 C 55 156 75 178 100 178 C 125 178 145 156 145 128 C 145 90 100 25 100 25 Z",
    hueA: 190,
    hueB: 220,
  },
  {
    id: "triangle",
    label: "Triangle",
    d: "M 100 28 L 172 162 L 28 162 Z",
    hueA: 120,
    hueB: 150,
  },
  {
    id: "star",
    label: "Star",
    d: "M 100 20 L 122 78 L 184 82 L 135 122 L 152 182 L 100 148 L 48 182 L 65 122 L 16 82 L 78 78 Z",
    hueA: 48,
    hueB: 58,
  },
  {
    id: "plus",
    label: "Cross",
    d: "M 85 28 L 115 28 L 115 85 L 172 85 L 172 115 L 115 115 L 115 172 L 85 172 L 85 115 L 28 115 L 28 85 L 85 85 Z",
    hueA: 0,
    hueB: 25,
  },
  {
    id: "blob",
    label: "Blob",
    d: "M 100 25 C 150 25 175 60 170 105 C 165 150 130 175 90 170 C 50 165 25 130 30 90 C 35 50 55 25 100 25 Z",
    hueA: 200,
    hueB: 270,
  },
  {
    id: "bolt",
    label: "Bolt",
    d: "M 118 22 L 55 110 L 92 110 L 78 178 L 148 92 L 110 92 Z",
    hueA: 22,
    hueB: 38,
  },
  {
    id: "moon",
    label: "Moon",
    d: "M 135 35 C 60 35 35 75 35 100 C 35 125 60 165 135 165 C 90 140 90 60 135 35 Z",
    hueA: 250,
    hueB: 285,
  },
  {
    id: "hex",
    label: "Hex",
    d: "M 100 25 L 165 62 L 165 138 L 100 175 L 35 138 L 35 62 Z",
    hueA: 160,
    hueB: 200,
  },
]

const MORPH_MS = 720
const SVG_NS = "http://www.w3.org/2000/svg"

export const shapeMorph: Demo = {
  id: "shape-morph",
  title: "Shape morph · structural blend",
  blurb:
    "Click a shape to morph between any pair. `morphPath` resamples both paths to a polyline and blends per-vertex, so it works across totally different topologies.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 35%, #1a1230 0%, #07080b 70%), radial-gradient(ellipse at 30% 80%, #0d2330 0%, transparent 60%)",
      display: "grid",
      gridTemplateRows: "1fr auto",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const canvas = document.createElement("div")
    Object.assign(canvas.style, {
      position: "relative",
      display: "grid",
      placeItems: "center",
    })
    wrap.appendChild(canvas)

    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", "0 0 200 200")
    Object.assign(svg.style, {
      width: "min(60vmin, 460px)",
      height: "min(60vmin, 460px)",
      display: "block",
      filter: "drop-shadow(0 30px 60px rgba(167,139,250,0.45))",
    })
    canvas.appendChild(svg)

    const defs = document.createElementNS(SVG_NS, "defs")
    svg.appendChild(defs)
    const grad = document.createElementNS(SVG_NS, "linearGradient")
    grad.setAttribute("id", "morph-grad")
    grad.setAttribute("x1", "0")
    grad.setAttribute("y1", "0")
    grad.setAttribute("x2", "1")
    grad.setAttribute("y2", "1")
    const stopA = document.createElementNS(SVG_NS, "stop")
    stopA.setAttribute("offset", "0%")
    const stopB = document.createElementNS(SVG_NS, "stop")
    stopB.setAttribute("offset", "100%")
    grad.appendChild(stopA)
    grad.appendChild(stopB)
    defs.appendChild(grad)

    const path = document.createElementNS(SVG_NS, "path")
    path.setAttribute("fill", "url(#morph-grad)")
    path.setAttribute("stroke", "rgba(255,255,255,0.85)")
    path.setAttribute("stroke-width", "1.5")
    path.setAttribute("stroke-linejoin", "round")
    svg.appendChild(path)

    const setShapeColors = (shape: ShapeDef): void => {
      stopA.setAttribute("stop-color", `hsl(${shape.hueA}, 90%, 65%)`)
      stopB.setAttribute("stop-color", `hsl(${shape.hueB}, 90%, 55%)`)
    }

    let current: ShapeDef = SHAPES[0] as ShapeDef
    path.setAttribute("d", current.d)
    setShapeColors(current)

    const tray = document.createElement("div")
    Object.assign(tray.style, {
      display: "flex",
      gap: "16px",
      justifyContent: "center",
      padding: "24px 32px 32px",
    })
    wrap.appendChild(tray)

    const buttons = new Map<string, HTMLButtonElement>()
    let activeMorph = 0

    const renderMorph = (target: ShapeDef): void => {
      if (target.id === current.id) return
      cancelAnimationFrame(activeMorph)
      const def = morphPath(current.d, target.d, {
        duration: MORPH_MS,
        easing: easeInOut,
        samples: 96,
      })

      // Color blends in parallel with shape morph; cleaner than another def.
      const fromA = current.hueA
      const fromB = current.hueB
      const toA = target.hueA
      const toB = target.hueB

      const start = performance.now()
      const step = (): void => {
        const p = Math.min(1, (performance.now() - start) / MORPH_MS)
        const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
        const v = def.interpolate(p)
        path.setAttribute("d", v.d)
        const hueA = fromA + (toA - fromA) * eased
        const hueB = fromB + (toB - fromB) * eased
        stopA.setAttribute("stop-color", `hsl(${hueA}, 90%, 65%)`)
        stopB.setAttribute("stop-color", `hsl(${hueB}, 90%, 55%)`)
        if (p < 1) {
          activeMorph = requestAnimationFrame(step)
        } else {
          activeMorph = 0
          current = target
          setShapeColors(target)
          updateActive(target.id)
        }
      }
      step()
    }

    const updateActive = (id: string): void => {
      for (const [bid, btn] of buttons) {
        const active = bid === id
        btn.style.background = active ? "rgba(167,139,250,0.25)" : "rgba(232,236,244,0.05)"
        btn.style.borderColor = active ? "rgba(167,139,250,0.7)" : "rgba(232,236,244,0.12)"
        btn.style.color = active ? "#fff" : "rgba(232,236,244,0.7)"
      }
    }

    for (const shape of SHAPES) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.innerHTML = `
        <svg viewBox="0 0 200 200" width="28" height="28" style="display:block;margin:0 auto 6px">
          <path d="${shape.d}" fill="currentColor" />
        </svg>
        <span>${shape.label}</span>
      `
      Object.assign(btn.style, {
        appearance: "none",
        border: "1px solid rgba(232,236,244,0.12)",
        background: "rgba(232,236,244,0.05)",
        color: "rgba(232,236,244,0.7)",
        font: "600 11px ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        padding: "10px 14px",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "all 200ms ease",
      })
      btn.addEventListener("click", () => renderMorph(shape))
      tray.appendChild(btn)
      buttons.set(shape.id, btn)
    }
    updateActive(current.id)

    // Auto-cycle through shapes a couple of times for first impression.
    let autoIdx = 0
    let autoActive = true
    const auto = window.setInterval(() => {
      if (!autoActive) return
      autoIdx = (autoIdx + 1) % SHAPES.length
      renderMorph(SHAPES[autoIdx] as ShapeDef)
    }, 1800)

    const stopAuto = (): void => {
      autoActive = false
    }
    tray.addEventListener("click", stopAuto)
    canvas.addEventListener("click", stopAuto)

    return () => {
      cancelAnimationFrame(activeMorph)
      window.clearInterval(auto)
      tray.removeEventListener("click", stopAuto)
      canvas.removeEventListener("click", stopAuto)
    }
  },
}
