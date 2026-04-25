import { playCanvas, spring } from "@kinem/core"
import type { Demo } from "../demo"

const SVG_NS = "http://www.w3.org/2000/svg"
const W = 720
const H = 520
const N_BRIDGE = 9
const ANCHOR_R = 60
const HANDLE_R = 50

export const gooDrag: Demo = {
  id: "goo-drag",
  title: "Stretchy goo drag",
  blurb:
    "Drag the floating blob. An SVG goo filter (Gaussian blur + threshold) bridges it back to the anchor through nine intermediate dots. Release and a kinem spring snaps it home.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 40%, #1c1530 0%, #07080b 70%)",
      cursor: "default",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const hint = document.createElement("div")
    hint.textContent = "drag the blob"
    Object.assign(hint.style, {
      position: "absolute",
      bottom: "32px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(232,236,244,0.55)",
      fontSize: "12px",
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      fontWeight: "600",
      pointerEvents: "none",
    })
    wrap.appendChild(hint)

    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet")
    Object.assign(svg.style, {
      maxWidth: "92%",
      maxHeight: "82%",
      overflow: "visible",
    })
    wrap.appendChild(svg)

    svg.innerHTML = `
      <defs>
        <filter id="goo-${Math.random().toString(36).slice(2, 8)}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
          <feColorMatrix values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 30 -14" />
        </filter>
        <linearGradient id="grad-blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fbbf24" />
          <stop offset="60%" stop-color="#f472b6" />
          <stop offset="100%" stop-color="#7c9cff" />
        </linearGradient>
        <radialGradient id="grad-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="rgba(244,114,182,0.4)" />
          <stop offset="100%" stop-color="rgba(244,114,182,0)" />
        </radialGradient>
      </defs>
    `
    const filterId = (svg.querySelector("filter") as SVGFilterElement).id

    // Soft glow under the goo (not filtered, so it stays diffuse)
    const glowEl = document.createElementNS(SVG_NS, "ellipse")
    glowEl.setAttribute("cx", String(W / 2))
    glowEl.setAttribute("cy", String(H / 2))
    glowEl.setAttribute("rx", "180")
    glowEl.setAttribute("ry", "140")
    glowEl.setAttribute("fill", "url(#grad-glow)")
    svg.appendChild(glowEl)

    const group = document.createElementNS(SVG_NS, "g")
    group.setAttribute("filter", `url(#${filterId})`)
    svg.appendChild(group)

    const anchorX = W / 2
    const anchorY = H / 2

    const anchor = document.createElementNS(SVG_NS, "circle")
    anchor.setAttribute("cx", String(anchorX))
    anchor.setAttribute("cy", String(anchorY))
    anchor.setAttribute("r", String(ANCHOR_R))
    anchor.setAttribute("fill", "url(#grad-blob)")
    group.appendChild(anchor)

    const bridges: SVGCircleElement[] = []
    for (let i = 0; i < N_BRIDGE; i++) {
      const c = document.createElementNS(SVG_NS, "circle")
      c.setAttribute("fill", "url(#grad-blob)")
      c.setAttribute("opacity", "0")
      group.appendChild(c)
      bridges.push(c)
    }

    const handle = document.createElementNS(SVG_NS, "circle")
    handle.setAttribute("cx", String(anchorX))
    handle.setAttribute("cy", String(anchorY))
    handle.setAttribute("r", String(HANDLE_R))
    handle.setAttribute("fill", "url(#grad-blob)")
    handle.style.cursor = "grab"
    handle.style.touchAction = "none"
    group.appendChild(handle)

    let hx = anchorX
    let hy = anchorY

    const updateBridges = (): void => {
      const dx = hx - anchorX
      const dy = hy - anchorY
      const dist = Math.hypot(dx, dy)
      const visible = dist > 30
      for (let i = 0; i < N_BRIDGE; i++) {
        const t = (i + 1) / (N_BRIDGE + 1)
        const x = anchorX + dx * t
        const y = anchorY + dy * t
        // Bridge size tapers with distance: thicker near endpoints, thinner in middle
        const taper = 1 - Math.abs(0.5 - t) * 1.4
        const r = Math.max(8, 36 - dist * 0.04) * taper
        const c = bridges[i]
        if (!c) continue
        c.setAttribute("cx", String(x))
        c.setAttribute("cy", String(y))
        c.setAttribute("r", String(r))
        c.setAttribute("opacity", visible ? "1" : "0")
      }
      handle.setAttribute("cx", String(hx))
      handle.setAttribute("cy", String(hy))
    }
    updateBridges()

    let activeSpring: ReturnType<typeof playCanvas> | null = null
    let dragging = false
    let pointerId = -1
    let startSvgX = 0
    let startSvgY = 0
    let startHx = 0
    let startHy = 0

    const screenToSvg = (clientX: number, clientY: number): { x: number; y: number } => {
      const r = svg.getBoundingClientRect()
      return {
        x: ((clientX - r.left) / r.width) * W,
        y: ((clientY - r.top) / r.height) * H,
      }
    }

    const onPointerDown = (e: PointerEvent): void => {
      activeSpring?.cancel()
      dragging = true
      pointerId = e.pointerId
      handle.setPointerCapture(pointerId)
      handle.style.cursor = "grabbing"
      const p = screenToSvg(e.clientX, e.clientY)
      startSvgX = p.x
      startSvgY = p.y
      startHx = hx
      startHy = hy
    }
    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging || e.pointerId !== pointerId) return
      const p = screenToSvg(e.clientX, e.clientY)
      hx = startHx + (p.x - startSvgX)
      hy = startHy + (p.y - startSvgY)
      updateBridges()
    }
    const onPointerUp = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return
      dragging = false
      handle.releasePointerCapture(pointerId)
      pointerId = -1
      handle.style.cursor = "grab"

      const fromX = hx
      const fromY = hy
      activeSpring = playCanvas(
        spring({ x: [fromX, anchorX], y: [fromY, anchorY] }, { stiffness: 75, damping: 9 }),
        (v) => {
          hx = v.x
          hy = v.y
          updateBridges()
        },
      )
    }

    handle.addEventListener("pointerdown", onPointerDown)
    handle.addEventListener("pointermove", onPointerMove)
    handle.addEventListener("pointerup", onPointerUp)
    handle.addEventListener("pointercancel", onPointerUp)

    return () => {
      activeSpring?.cancel()
      handle.removeEventListener("pointerdown", onPointerDown)
      handle.removeEventListener("pointermove", onPointerMove)
      handle.removeEventListener("pointerup", onPointerUp)
      handle.removeEventListener("pointercancel", onPointerUp)
    }
  },
}
