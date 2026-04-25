import { easeOut, gesture, play, spring, tween } from "@kinem/core"
import type { Demo } from "../demo"

const HOLD_MS = 900

export const pressCharge: Demo = {
  id: "press-charge",
  title: "Press & hold → charge",
  blurb:
    "Hold the button to charge. Release fully charged for an explosion; let go early and the ring drains.",
  group: "Gesture",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(circle at 50% 50%, #0f1220 0%, #07080b 70%)",
    })
    stage.appendChild(wrap)

    const root = document.createElement("div")
    Object.assign(root.style, {
      position: "relative",
      width: "240px",
      height: "240px",
    })
    wrap.appendChild(root)

    const SVG_NS = "http://www.w3.org/2000/svg"
    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", "0 0 120 120")
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    })
    root.appendChild(svg)

    const defs = document.createElementNS(SVG_NS, "defs")
    defs.innerHTML =
      '<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7c9cff"/><stop offset="100%" stop-color="#f472b6"/></linearGradient>'
    svg.appendChild(defs)

    const trackRing = document.createElementNS(SVG_NS, "circle")
    trackRing.setAttribute("cx", "60")
    trackRing.setAttribute("cy", "60")
    trackRing.setAttribute("r", "52")
    trackRing.setAttribute("fill", "none")
    trackRing.setAttribute("stroke", "rgba(124,156,255,0.15)")
    trackRing.setAttribute("stroke-width", "4")
    svg.appendChild(trackRing)

    const progressRing = document.createElementNS(SVG_NS, "circle")
    progressRing.setAttribute("cx", "60")
    progressRing.setAttribute("cy", "60")
    progressRing.setAttribute("r", "52")
    progressRing.setAttribute("fill", "none")
    progressRing.setAttribute("stroke", "url(#grad)")
    progressRing.setAttribute("stroke-width", "5")
    progressRing.setAttribute("stroke-linecap", "round")
    progressRing.setAttribute("transform", "rotate(-90 60 60)")
    const circumference = 2 * Math.PI * 52
    progressRing.setAttribute("stroke-dasharray", String(circumference))
    progressRing.setAttribute("stroke-dashoffset", String(circumference))
    svg.appendChild(progressRing)

    const btn = document.createElement("button")
    btn.textContent = "HOLD"
    Object.assign(btn.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "140px",
      height: "140px",
      borderRadius: "50%",
      border: "none",
      background: "linear-gradient(135deg, #1a1f2e 0%, #0f1220 100%)",
      color: "#e8ecf4",
      fontSize: "14px",
      fontWeight: "700",
      letterSpacing: "0.2em",
      cursor: "pointer",
      boxShadow: "0 0 0 1px rgba(124,156,255,0.25), 0 8px 32px rgba(124,156,255,0.15)",
      touchAction: "none",
      userSelect: "none",
    })
    root.appendChild(btn)

    const setRing = (p: number): void => {
      progressRing.setAttribute("stroke-dashoffset", String(circumference * (1 - p)))
    }

    const explode = (): void => {
      const r = root.getBoundingClientRect()
      const cx = r.width / 2
      const cy = r.height / 2
      for (let i = 0; i < 28; i++) {
        const dot = document.createElement("div")
        const hue = 200 + Math.random() * 140
        Object.assign(dot.style, {
          position: "absolute",
          left: `${cx}px`,
          top: `${cy}px`,
          width: "10px",
          height: "10px",
          marginLeft: "-5px",
          marginTop: "-5px",
          borderRadius: "50%",
          background: `hsl(${hue}, 90%, 65%)`,
          boxShadow: `0 0 16px hsla(${hue}, 90%, 65%, 0.8)`,
          pointerEvents: "none",
          willChange: "transform, opacity",
        })
        root.appendChild(dot)
        const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.2
        const dist = 180 + Math.random() * 120
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        const dotCtl = play(
          tween(
            {
              translateX: [0, dx],
              translateY: [0, dy],
              scale: [1, 0],
              opacity: [1, 0],
            },
            { duration: 900, easing: easeOut },
          ),
          dot,
        )
        dotCtl.finished.then(() => dot.remove()).catch(() => {})
      }
    }

    let phase: "idle" | "charging" | "draining" = "idle"
    let chargeStart = 0
    let progress = 0
    let drainStart = 0
    let drainFrom = 0

    const tick = (): void => {
      if (phase === "charging") {
        progress = Math.min(1, (performance.now() - chargeStart) / HOLD_MS)
        setRing(progress)
      } else if (phase === "draining") {
        const t = Math.min(1, (performance.now() - drainStart) / 280)
        const eased = 1 - (1 - t) * (1 - t) * (1 - t)
        progress = drainFrom * (1 - eased)
        setRing(progress)
        if (t >= 1) phase = "idle"
      }
      rafId = requestAnimationFrame(tick)
    }
    let rafId = requestAnimationFrame(tick)

    const beginDrain = (): void => {
      drainFrom = progress
      drainStart = performance.now()
      phase = "draining"
    }

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId)
      phase = "charging"
      chargeStart = performance.now()
      play(spring({ scale: [1, 0.94] }, { stiffness: 320, damping: 18 }), btn)
    })

    const release = (): void => {
      if (phase === "charging") beginDrain()
      play(spring({ scale: [0.94, 1] }, { stiffness: 260, damping: 14 }), btn)
    }
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
    btn.addEventListener("pointerleave", release)

    const pressHandle = gesture.press(btn, {
      minDuration: HOLD_MS,
      onPress: () => {
        phase = "idle"
        progress = 0
        setRing(0)
        explode()
      },
    })

    return () => {
      cancelAnimationFrame(rafId)
      pressHandle.cancel()
    }
  },
}
