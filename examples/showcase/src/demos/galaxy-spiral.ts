import { catmullRom, playValues } from "@kinem/core"
import type { AnimationDef } from "@kinem/core"
import type { Demo } from "../demo"

const ARM_COUNT = 4
const PARTICLES_PER_ARM = 70
const ARM_TURNS = 1.4
const ARM_WAYPOINTS = 18
const ARM_INNER_R = 38
const ARM_OUTER_R = 320
const SVG_NS = "http://www.w3.org/2000/svg"

interface ArmDef {
  def: AnimationDef<{ x: number; y: number }>
  hue: number
}

interface Particle {
  el: SVGCircleElement
  phase: number
  speed: number
  arm: ArmDef
}

export const galaxySpiral: Demo = {
  id: "galaxy-spiral",
  title: "Galaxy spiral · catmull-rom arms",
  blurb:
    "Four spiral arms, each a `catmullRom` spline through 18 waypoints. Hundreds of particles flow along the arms with phase offsets, wrapping to the inside as they reach the rim. Move the cursor over the disk to drag particles toward it; click to fire a burst that briefly accelerates the whole flow.",
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

    const starField = document.createElement("div")
    Object.assign(starField.style, { position: "absolute", inset: "0", pointerEvents: "none" })
    wrap.appendChild(starField)
    for (let i = 0; i < 90; i++) {
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
        opacity: String(0.3 + Math.random() * 0.7),
      })
      starField.appendChild(s)
    }

    const svg = document.createElementNS(SVG_NS, "svg")
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    })
    wrap.appendChild(svg)

    const layer = document.createElementNS(SVG_NS, "g")
    svg.appendChild(layer)

    const armColors = [195, 285, 340, 50]
    const arms: ArmDef[] = []
    for (let a = 0; a < ARM_COUNT; a++) {
      const armRot = (a / ARM_COUNT) * Math.PI * 2
      const points: [number, number][] = []
      for (let i = 0; i < ARM_WAYPOINTS; i++) {
        const u = i / (ARM_WAYPOINTS - 1)
        const theta = armRot + u * Math.PI * 2 * ARM_TURNS
        const r = ARM_INNER_R + u * (ARM_OUTER_R - ARM_INNER_R)
        points.push([Math.cos(theta) * r, Math.sin(theta) * r])
      }
      const def = catmullRom(points, { duration: 1, tension: 0 }) as AnimationDef<{
        x: number
        y: number
      }>

      const guide = document.createElementNS(SVG_NS, "polyline")
      const samples: string[] = []
      for (let s = 0; s <= 80; s++) {
        const v = def.interpolate(s / 80)
        samples.push(`${v.x.toFixed(2)},${v.y.toFixed(2)}`)
      }
      guide.setAttribute("points", samples.join(" "))
      guide.setAttribute("fill", "none")
      guide.setAttribute("stroke", `hsla(${armColors[a]}, 80%, 65%, 0.12)`)
      guide.setAttribute("stroke-width", "1")
      layer.appendChild(guide)

      arms.push({ def, hue: armColors[a] ?? 200 })
    }

    const sun = document.createElementNS(SVG_NS, "circle")
    sun.setAttribute("r", "26")
    sun.setAttribute("fill", "url(#galaxy-sun)")
    layer.appendChild(sun)

    const defs = document.createElementNS(SVG_NS, "defs")
    svg.appendChild(defs)
    const sunGrad = document.createElementNS(SVG_NS, "radialGradient")
    sunGrad.setAttribute("id", "galaxy-sun")
    sunGrad.innerHTML = `
      <stop offset="0%" stop-color="#fff" />
      <stop offset="40%" stop-color="#fde68a" />
      <stop offset="80%" stop-color="rgba(251,191,36,0.55)" />
      <stop offset="100%" stop-color="rgba(251,191,36,0)" />
    `
    defs.appendChild(sunGrad)

    const particles: Particle[] = []
    for (const arm of arms) {
      for (let i = 0; i < PARTICLES_PER_ARM; i++) {
        const c = document.createElementNS(SVG_NS, "circle")
        const size = 0.8 + Math.random() * 2.2
        c.setAttribute("r", size.toFixed(2))
        c.setAttribute(
          "fill",
          `hsla(${arm.hue + Math.random() * 25 - 12}, 95%, ${68 + Math.random() * 18}%, ${0.6 + Math.random() * 0.4})`,
        )
        layer.appendChild(c)
        particles.push({
          el: c,
          phase: i / PARTICLES_PER_ARM + Math.random() * 0.01,
          speed: 0.085 + Math.random() * 0.07,
          arm,
        })
      }
    }

    let mouseX = 0
    let mouseY = 0
    let inside = false
    let burst = 0

    const onMove = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      mouseX = e.clientX - r.left
      mouseY = e.clientY - r.top
      inside = true
    }
    const onLeave = (): void => {
      inside = false
    }
    const onDown = (): void => {
      burst = 1
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)
    wrap.addEventListener("pointerdown", onDown)

    let layerRot = 0
    let last = performance.now()
    const DEG = Math.PI / 180

    // Per-particle phase advances by real-time dt; the loop is open-ended.
    // playValues with repeat:true gives us a tracked entry plus a clean
    // cancel handle on unmount.
    const handle = playValues(
      { duration: 16_000, interpolate: (p) => p },
      () => {
        const now = performance.now()
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now

        const cx = wrap.clientWidth / 2
        const cy = wrap.clientHeight / 2
        layerRot += dt * 22
        burst = Math.max(0, burst - dt * 1.5)

        layer.setAttribute(
          "transform",
          `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${layerRot.toFixed(3)})`,
        )

        // Convert cursor from screen to layer-local (undo translate then rotate).
        const sx = mouseX - cx
        const sy = mouseY - cy
        const ang = -layerRot * DEG
        const cosA = Math.cos(ang)
        const sinA = Math.sin(ang)
        const lx = sx * cosA - sy * sinA
        const ly = sx * sinA + sy * cosA

        const pullStrength = inside ? 1 : 0
        const speedMult = 1 + burst * 3

        for (const p of particles) {
          p.phase = (((p.phase + dt * p.speed * speedMult) % 1) + 1) % 1
          const v = p.arm.def.interpolate(p.phase)
          let px = v.x
          let py = v.y
          if (pullStrength > 0) {
            const dx = lx - px
            const dy = ly - py
            const d2 = dx * dx + dy * dy
            // Gaussian falloff (sigma ~ 90px); never overshoots since k <= 0.45.
            const k = 0.45 * pullStrength * Math.exp(-d2 / 16200)
            px += dx * k
            py += dy * k
          }
          p.el.setAttribute("cx", px.toFixed(2))
          p.el.setAttribute("cy", py.toFixed(2))
        }
      },
      { repeat: true },
    )

    return () => {
      handle.cancel()
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      wrap.removeEventListener("pointerdown", onDown)
    }
  },
}
