import { easeInOut, motionPath, play, spring } from "@kinem/core"
import type { Demo } from "../demo"

const PATH_D = "M 60 480 C 200 200, 360 100, 520 300 S 820 540, 940 200 C 980 80, 700 40, 500 120"
const FLIGHT_DURATION = 4200

export const pathFlight: Demo = {
  id: "path-flight",
  title: "Motion path · paper plane",
  blurb:
    "A paper plane follows an SVG path with arc-length parameterization, so it moves at constant speed even through tight curves. Tangent rotation keeps it pointed forward. Click to launch.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 30% 20%, #1e1b4b 0%, #07080b 70%), radial-gradient(ellipse at 70% 80%, #312e81 0%, transparent 60%)",
      cursor: "pointer",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const SVG_NS = "http://www.w3.org/2000/svg"

    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", "0 0 1000 600")
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice")
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    })
    wrap.appendChild(svg)

    // Static glow path
    const glow = document.createElementNS(SVG_NS, "path")
    glow.setAttribute("d", PATH_D)
    glow.setAttribute("fill", "none")
    glow.setAttribute("stroke", "rgba(124,156,255,0.18)")
    glow.setAttribute("stroke-width", "2.5")
    glow.setAttribute("stroke-linecap", "round")
    svg.appendChild(glow)

    const dashed = document.createElementNS(SVG_NS, "path")
    dashed.setAttribute("d", PATH_D)
    dashed.setAttribute("fill", "none")
    dashed.setAttribute("stroke", "rgba(232,236,244,0.22)")
    dashed.setAttribute("stroke-width", "1.5")
    dashed.setAttribute("stroke-dasharray", "6 8")
    dashed.setAttribute("stroke-linecap", "round")
    svg.appendChild(dashed)

    const plane = document.createElement("div")
    Object.assign(plane.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      pointerEvents: "none",
      filter: "drop-shadow(0 6px 18px rgba(124,156,255,0.55))",
      willChange: "transform",
    })
    plane.innerHTML = `
      <svg width="48" height="48" viewBox="-24 -24 48 48" style="overflow:visible;display:block">
        <defs>
          <linearGradient id="plane-grad" x1="-1" y1="-1" x2="1" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="60%" stop-color="#f472b6"/>
            <stop offset="100%" stop-color="#7c9cff"/>
          </linearGradient>
        </defs>
        <polygon points="-18,-10 22,0 -18,10 -10,0" fill="url(#plane-grad)" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" stroke-linejoin="round"/>
        <polygon points="-18,-10 -10,0 -2,-2" fill="rgba(0,0,0,0.25)"/>
      </svg>
    `
    wrap.appendChild(plane)

    const hint = document.createElement("div")
    hint.textContent = "click to launch"
    Object.assign(hint.style, {
      position: "absolute",
      left: "50%",
      bottom: "32px",
      transform: "translateX(-50%)",
      color: "rgba(232,236,244,0.55)",
      fontSize: "12px",
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      pointerEvents: "none",
      fontWeight: "600",
    })
    wrap.appendChild(hint)

    // Trail dots
    const trail: HTMLDivElement[] = []
    const spawnSpark = (x: number, y: number): void => {
      const dot = document.createElement("div")
      const hue = 200 + Math.random() * 140
      Object.assign(dot.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: "5px",
        height: "5px",
        marginLeft: "-2.5px",
        marginTop: "-2.5px",
        borderRadius: "50%",
        background: `hsl(${hue}, 90%, 70%)`,
        boxShadow: `0 0 10px hsla(${hue}, 90%, 70%, 0.85)`,
        pointerEvents: "none",
        willChange: "transform, opacity",
      })
      wrap.appendChild(dot)
      trail.push(dot)
      const ctl = play(
        spring({ scale: [1, 0], opacity: [1, 0] }, { stiffness: 70, damping: 16 }),
        dot,
      )
      ctl.finished
        .then(() => {
          dot.remove()
          const idx = trail.indexOf(dot)
          if (idx >= 0) trail.splice(idx, 1)
        })
        .catch(() => {})
    }

    const pathDef = motionPath(PATH_D, {
      duration: FLIGHT_DURATION,
      easing: easeInOut,
      rotateAlongPath: true,
    })

    let rafId = 0
    let flightStart = 0
    let lastSpark = 0

    const tick = (): void => {
      const now = performance.now()
      const elapsed = now - flightStart
      const progress = Math.min(1, elapsed / FLIGHT_DURATION)

      const w = wrap.clientWidth
      const h = wrap.clientHeight
      const sx = w / 1000
      const sy = h / 600

      const v = pathDef.interpolate(progress)
      const px = v.x * sx
      const py = v.y * sy
      plane.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${v.rotate ?? 0}deg)`

      if (now - lastSpark > 36 && progress > 0 && progress < 1) {
        spawnSpark(px, py)
        lastSpark = now
      }

      if (progress < 1) rafId = requestAnimationFrame(tick)
    }

    const launch = (): void => {
      cancelAnimationFrame(rafId)
      flightStart = performance.now()
      lastSpark = 0
      rafId = requestAnimationFrame(tick)
    }

    const onClick = (): void => launch()
    wrap.addEventListener("pointerdown", onClick)

    const startTimer = window.setTimeout(launch, 350)

    return () => {
      window.clearTimeout(startTimer)
      cancelAnimationFrame(rafId)
      wrap.removeEventListener("pointerdown", onClick)
      for (const dot of trail) dot.remove()
      trail.length = 0
    }
  },
}
