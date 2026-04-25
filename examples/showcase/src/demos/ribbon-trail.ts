import { follow } from "@kinem/core"
import type { Demo } from "../demo"

const N = 32
const SVG_NS = "http://www.w3.org/2000/svg"

export const ribbonTrail: Demo = {
  id: "ribbon-trail",
  title: "Ribbon trail · tapered follow chain",
  blurb:
    "Move the cursor. A 32-link `follow` chain feeds an SVG ribbon rendered as N tapered segments. Each segment shrinks down the chain — head full, tail thin — for a calligraphic stroke trail.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 50%, #1a103a 0%, #07080b 70%), radial-gradient(ellipse at 80% 20%, #2c1d4a 0%, transparent 60%)",
      cursor: "crosshair",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const svg = document.createElementNS(SVG_NS, "svg")
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    })
    wrap.appendChild(svg)

    const defs = document.createElementNS(SVG_NS, "defs")
    svg.appendChild(defs)

    const grad = document.createElementNS(SVG_NS, "linearGradient")
    grad.setAttribute("id", "ribbon-grad")
    grad.setAttribute("gradientUnits", "userSpaceOnUse")
    grad.setAttribute("x1", "0")
    grad.setAttribute("y1", "0")
    grad.setAttribute("x2", "1")
    grad.setAttribute("y2", "0")
    const stops: [string, string][] = [
      ["0%", "#f0abfc"],
      ["35%", "#a78bfa"],
      ["70%", "#60a5fa"],
      ["100%", "#22d3ee"],
    ]
    for (const [offset, color] of stops) {
      const s = document.createElementNS(SVG_NS, "stop")
      s.setAttribute("offset", offset)
      s.setAttribute("stop-color", color)
      grad.appendChild(s)
    }
    defs.appendChild(grad)

    const segs: SVGLineElement[] = []
    for (let i = 0; i < N; i++) {
      const t = i / N
      const ln = document.createElementNS(SVG_NS, "line")
      ln.setAttribute("stroke", "url(#ribbon-grad)")
      ln.setAttribute("stroke-width", String(36 * (1 - t * 0.95) + 1.4))
      ln.setAttribute("stroke-linecap", "round")
      ln.setAttribute("opacity", String(1 - t * 0.65))
      svg.appendChild(ln)
      segs.push(ln)
    }

    const xs = new Array<number>(N).fill(0)
    const ys = new Array<number>(N).fill(0)
    let leaderX = 0
    let leaderY = 0

    const drawRibbon = (): void => {
      let prevX = leaderX
      let prevY = leaderY
      for (let i = 0; i < N; i++) {
        const ln = segs[i]
        if (!ln) continue
        ln.setAttribute("x1", prevX.toFixed(2))
        ln.setAttribute("y1", prevY.toFixed(2))
        ln.setAttribute("x2", (xs[i] as number).toFixed(2))
        ln.setAttribute("y2", (ys[i] as number).toFixed(2))
        prevX = xs[i] as number
        prevY = ys[i] as number
      }
    }

    const fakeStyle = { setProperty: (): void => {} }
    const targets = Array.from({ length: N }, () => ({ style: fakeStyle }))

    const handle = follow(targets, {
      stiffness: 0.42,
      decay: 0.93,
      commit: (_t, x, y, idx) => {
        xs[idx] = x
        ys[idx] = y
        if (idx === N - 1) drawRibbon()
      },
    })

    const cx = wrap.clientWidth / 2
    const cy = wrap.clientHeight / 2
    leaderX = cx
    leaderY = cy
    handle.snapTo(cx, cy)

    let inside = false

    const onMove = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      if (!inside) {
        inside = true
        leaderX = x
        leaderY = y
        handle.snapTo(x, y)
      }
      leaderX = x
      leaderY = y
      handle.setLeader(x, y)
    }
    const onLeave = (): void => {
      inside = false
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    let rafId = 0
    const start = performance.now()
    const idle = (): void => {
      if (!inside) {
        const t = (performance.now() - start) / 1000
        const w = wrap.clientWidth
        const h = wrap.clientHeight
        const lx = w / 2 + Math.cos(t * 0.55) * (w * 0.32)
        const ly = h / 2 + Math.sin(t * 0.85) * (h * 0.28)
        leaderX = lx
        leaderY = ly
        handle.setLeader(lx, ly)
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
