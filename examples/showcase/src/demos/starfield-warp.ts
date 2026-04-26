import { jitter } from "@kinem/core"
import type { AnimationDef } from "@kinem/core"
import type { Demo } from "../demo"

const STAR_COUNT = 180
const SPEED_MIN = 0.18
const SPEED_MAX = 0.55
const SVG_NS = "http://www.w3.org/2000/svg"

interface TwinkleVal {
  v: number
}

interface Star {
  theta: number
  z: number
  speed: number
  hue: number
  twinkle: AnimationDef<TwinkleVal>
  twinklePhase: number
  line: SVGLineElement
}

export const starfieldWarp: Demo = {
  id: "starfield-warp",
  title: "Starfield warp · radial hyperdrive",
  blurb:
    "Stars stream outward from a moving warp center with non-linear depth acceleration. Each star's brightness pulses through its own `jitter` channel for organic twinkle. Move the cursor to steer the warp.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 50%, #0a0d2a 0%, #050614 70%), radial-gradient(ellipse at 30% 80%, #1d1245 0%, transparent 60%)",
      overflow: "hidden",
      cursor: "crosshair",
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

    const baseTwinkle: AnimationDef<TwinkleVal> = {
      duration: 1000,
      interpolate: () => ({ v: 0 }),
    }

    const stars: Star[] = []
    for (let i = 0; i < STAR_COUNT; i++) {
      const ln = document.createElementNS(SVG_NS, "line")
      ln.setAttribute("stroke-linecap", "round")
      svg.appendChild(ln)
      stars.push({
        theta: Math.random() * Math.PI * 2,
        z: Math.random(),
        speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
        hue: 195 + Math.random() * 70,
        twinkle: jitter(baseTwinkle, { amplitude: 0.45, frequency: 4, seed: i * 7 + 11 }),
        twinklePhase: Math.random(),
        line: ln,
      })
    }

    let cx = wrap.clientWidth / 2
    let cy = wrap.clientHeight / 2
    let warpX = cx
    let warpY = cy
    let mouseX = cx
    let mouseY = cy
    let inside = false

    const onMove = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      mouseX = e.clientX - r.left
      mouseY = e.clientY - r.top
      inside = true
    }
    const onLeave = (): void => {
      inside = false
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    const onResize = (): void => {
      cx = wrap.clientWidth / 2
      cy = wrap.clientHeight / 2
      if (!inside) {
        mouseX = cx
        mouseY = cy
      }
    }
    window.addEventListener("resize", onResize)

    let rafId = 0
    let last = performance.now()
    const start = last

    const tick = (): void => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const tt = (now - start) / 1000

      const targetX = inside ? mouseX : cx
      const targetY = inside ? mouseY : cy
      warpX += (targetX - warpX) * 0.06
      warpY += (targetY - warpY) * 0.06

      const w = wrap.clientWidth
      const h = wrap.clientHeight
      const maxR = Math.hypot(w, h) * 0.65

      for (const s of stars) {
        const newZ = s.z + dt * s.speed * (1 + 2.6 * s.z)
        const prevR = s.z * maxR
        const curR = newZ * maxR
        const cos = Math.cos(s.theta)
        const sin = Math.sin(s.theta)

        const x1 = warpX + cos * prevR
        const y1 = warpY + sin * prevR
        const x2 = warpX + cos * curR
        const y2 = warpY + sin * curR

        s.z = newZ
        if (s.z > 1.05) {
          s.z = 0
          s.theta = Math.random() * Math.PI * 2
          s.speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)
          s.line.setAttribute("x1", "0")
          s.line.setAttribute("y1", "0")
          s.line.setAttribute("x2", "0")
          s.line.setAttribute("y2", "0")
          continue
        }

        const fade = Math.min(1, s.z * 4)
        const twinkle = 0.7 + s.twinkle.interpolate((((tt * 0.4 + s.twinklePhase) % 1) + 1) % 1).v
        const alpha = Math.max(0, Math.min(1, fade * twinkle))
        const width = 0.6 + s.z * 2.4
        s.line.setAttribute("x1", x1.toFixed(2))
        s.line.setAttribute("y1", y1.toFixed(2))
        s.line.setAttribute("x2", x2.toFixed(2))
        s.line.setAttribute("y2", y2.toFixed(2))
        s.line.setAttribute("stroke", `hsla(${s.hue.toFixed(0)}, 95%, 80%, ${alpha.toFixed(3)})`)
        s.line.setAttribute("stroke-width", width.toFixed(2))
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("resize", onResize)
    }
  },
}
