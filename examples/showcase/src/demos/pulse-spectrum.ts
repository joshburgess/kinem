import { motionValue, time, transform, velocity } from "@kinem/core"
import type { Demo } from "../demo"

const SVG_NS = "http://www.w3.org/2000/svg"
const W = 720
const H = 420
const N_BARS = 28
const BAR_GAP = 4
const BAR_W = (W - BAR_GAP * (N_BARS + 1)) / N_BARS

// One pulse cycle. Each bar samples this cycle at a phase offset that
// depends on its index plus a mouse-x driven shift; the result is a
// travelling wave whose direction and speed track the cursor.
const PULSE_PERIOD = 2_400

export const pulseSpectrum: Demo = {
  id: "pulse-spectrum",
  title: "Pulse spectrum reactive composition",
  blurb:
    "A bar of stripes whose heights, hues, and glow are all derived MotionValues fanned out from a single time() source. Mouse-x feeds a motionValue; its velocity pushes a phase-shift through transform(), so the whole spectrum tilts and surfs with the cursor without touching rAF.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 60%, #0d0a1f 0%, #060410 55%, #020108 100%)",
      overflow: "hidden",
      cursor: "crosshair",
    })
    stage.appendChild(wrap)

    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("width", String(W))
    svg.setAttribute("height", String(H))
    Object.assign(svg.style, {
      filter: "drop-shadow(0 12px 60px rgba(120, 80, 220, 0.35))",
      maxWidth: "92vw",
      height: "auto",
    })
    wrap.appendChild(svg)

    const defs = document.createElementNS(SVG_NS, "defs")
    const filterId = `pulse-glow-${Math.random().toString(36).slice(2, 8)}`
    defs.innerHTML = `
      <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" />
        <feComponentTransfer><feFuncA type="linear" slope="1.6" /></feComponentTransfer>
        <feComposite in="SourceGraphic" />
      </filter>
    `
    svg.appendChild(defs)

    const bg = document.createElementNS(SVG_NS, "rect")
    bg.setAttribute("x", "0")
    bg.setAttribute("y", "0")
    bg.setAttribute("width", String(W))
    bg.setAttribute("height", String(H))
    bg.setAttribute("fill", "transparent")
    svg.appendChild(bg)

    const baseline = H * 0.85

    // Reactive sources.
    //  - t: continuous ms tick driven by rAF
    //  - mouseX: cursor position normalized to [0, 1]
    //  - vx: signed velocity of mouseX (units per ms), used to "tilt" the wave
    const t = time()
    const mouseX = motionValue(0.5)
    const vx = velocity(mouseX)

    // Derived: phase offset multiplier. velocity comes through in 1/ms,
    // typical drag values land around ±0.002. We build a `transform()`
    // mapper once, then push values from `vx` through it into a derived
    // MotionValue — the reactive-composition idiom at the core layer.
    const tiltMap = transform([-0.003, 0, 0.003], [-2, 0, 2])
    const tilt = motionValue(tiltMap(vx.get()))
    const offDeriveTilt = vx.on((v) => {
      tilt.set(tiltMap(v))
    })

    interface BarBindings {
      readonly el: SVGRectElement
      readonly cleanup: () => void
    }

    const bars: BarBindings[] = []

    for (let i = 0; i < N_BARS; i++) {
      const x = BAR_GAP + i * (BAR_W + BAR_GAP)
      const indexU = i / (N_BARS - 1)

      const rect = document.createElementNS(SVG_NS, "rect")
      rect.setAttribute("x", x.toFixed(2))
      rect.setAttribute("width", BAR_W.toFixed(2))
      rect.setAttribute("rx", "3")
      rect.setAttribute("ry", "3")
      rect.setAttribute("filter", `url(#${filterId})`)
      svg.appendChild(rect)

      // Each bar reacts to time + tilt by recomputing its own phase. We
      // subscribe to both sources via .on(); the bar's "current state"
      // is just a function of (now, tilt.get()), so we re-render on any
      // change to either source.
      const render = (): void => {
        const now = t.get()
        const tiltNow = tilt.get()
        // Phase: the bar's index drives the spatial offset; tilt slides
        // the wave along the bar in the cursor's velocity direction.
        const phase = indexU * Math.PI * 2 - (now / PULSE_PERIOD) * Math.PI * 2 + tiltNow * indexU
        const u = (Math.sin(phase) + 1) / 2 // 0..1

        const hMax = H * 0.7
        const hMin = H * 0.06
        const barH = hMin + (hMax - hMin) * u
        rect.setAttribute("y", (baseline - barH).toFixed(2))
        rect.setAttribute("height", barH.toFixed(2))

        // Hue cycles slowly with time and shifts per bar so adjacent
        // stripes never share a colour. Saturation/lightness peak at
        // the wave's crest for a "lit" feeling.
        const hue = (indexU * 80 + now / 60) % 360
        const sat = 70 + u * 25
        const light = 38 + u * 30
        rect.setAttribute("fill", `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`)
      }
      render()

      const offT = t.on(render)
      const offTilt = tilt.on(render)

      bars.push({
        el: rect,
        cleanup: () => {
          offT()
          offTilt()
        },
      })
    }

    // Reactive readout panel: shows the live values of the derived MVs
    // the bars depend on, so the demo doubles as a tour of the API.
    const readout = document.createElement("div")
    Object.assign(readout.style, {
      position: "absolute",
      left: "16px",
      bottom: "16px",
      padding: "10px 14px",
      borderRadius: "10px",
      background: "rgba(8, 6, 22, 0.55)",
      border: "1px solid rgba(160, 130, 255, 0.18)",
      color: "#cdbcff",
      font: "12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
      backdropFilter: "blur(6px)",
      pointerEvents: "none",
      minWidth: "180px",
    })
    readout.innerHTML = `
      <div style="opacity: 0.6; margin-bottom: 4px">reactive sources</div>
      <div>time()&nbsp;&nbsp;&nbsp;<span data-k="t">0</span> ms</div>
      <div>mouseX&nbsp;&nbsp;<span data-k="x">0.500</span></div>
      <div>velocity&nbsp;<span data-k="v">+0.0000</span></div>
      <div>tilt&nbsp;&nbsp;&nbsp;&nbsp;<span data-k="tilt">+0.000</span></div>
    `
    wrap.appendChild(readout)
    const tCell = readout.querySelector('[data-k="t"]') as HTMLElement
    const xCell = readout.querySelector('[data-k="x"]') as HTMLElement
    const vCell = readout.querySelector('[data-k="v"]') as HTMLElement
    const tiltCell = readout.querySelector('[data-k="tilt"]') as HTMLElement

    const offRT = t.on((value) => {
      tCell.textContent = String(Math.round(value))
    })
    const offRX = mouseX.on((value) => {
      xCell.textContent = value.toFixed(3)
    })
    const offRV = vx.on((value) => {
      const sign = value >= 0 ? "+" : ""
      vCell.textContent = `${sign}${value.toFixed(4)}`
    })
    const offRTilt = tilt.on((value) => {
      const sign = value >= 0 ? "+" : ""
      tiltCell.textContent = `${sign}${value.toFixed(2)}`
    })

    // Cursor tracking. Update the source MV; tilt + bars react via .on().
    const onMove = (ev: PointerEvent): void => {
      const rect = wrap.getBoundingClientRect()
      const u = (ev.clientX - rect.left) / rect.width
      mouseX.set(Math.max(0, Math.min(1, u)))
    }
    const onLeave = (): void => {
      // Decay back toward centre; setting the same value as before is a
      // no-op for listeners, so we only nudge if we're not already there.
      mouseX.set(0.5)
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    return () => {
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      for (const b of bars) b.cleanup()
      offRT()
      offRX()
      offRV()
      offRTilt()
      offDeriveTilt()
      tilt.destroy()
      vx.destroy()
      mouseX.destroy()
      t.destroy()
    }
  },
}
