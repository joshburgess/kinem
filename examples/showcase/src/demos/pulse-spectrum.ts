import { motionValue, time, transform, velocity } from "@kinem/core"
import type { Demo } from "../demo"

const SVG_NS = "http://www.w3.org/2000/svg"
const W = 720
const H = 420
const N_BARS = 28
const BAR_GAP = 4
const BAR_W = (W - BAR_GAP * (N_BARS + 1)) / N_BARS

const PULSE_PERIOD = 2_400

export const pulseSpectrum: Demo = {
  id: "pulse-spectrum",
  title: "Pulse spectrum reactive composition",
  blurb:
    "A bar of stripes whose heights, hues, and glow are derived from a single time() source plus a cursor motionValue. Move the cursor across the spectrum: bars under the cursor swell with a transform()-mapped spotlight, mouse-y scales overall amplitude, and cursor velocity kicks a hue shift. Every visible property is a function of one of four reactive sources.",
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

    const baseline = H * 0.85

    // Reactive sources.
    //  - t: continuous ms tick driven by rAF
    //  - mouseX, mouseY: cursor position normalized to [0, 1]
    //  - vx: signed velocity of mouseX in 1/ms
    const t = time()
    const mouseX = motionValue(0.5)
    const mouseY = motionValue(0.5)
    const vx = velocity(mouseX)

    // Pre-built mappers from transform(). These are pure functions; we
    // pass MotionValue snapshots through them inside `render`. The point
    // of using transform here is the clamp + multi-stop semantics, not
    // reactivity — reactivity is wired by subscribing to the sources.
    const spotlightMap = transform([0, 0.18], [1, 0]) // distance from cursor → 0..1 bonus
    const amplitudeMap = transform([0, 0.3, 0.7, 1], [0.45, 0.7, 1.1, 1.4]) // mouseY → height scale
    const hueKickMap = transform([-0.004, 0, 0.004], [-90, 0, 90]) // velocity → degrees of hue offset

    const bars: Array<{ readonly el: SVGRectElement; readonly indexU: number }> = []

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
      bars.push({ el: rect, indexU })
    }

    const renderAll = (): void => {
      const now = t.get()
      const mx = mouseX.get()
      const my = mouseY.get()
      const v = vx.get()

      const ampScale = amplitudeMap(my)
      const hueKick = hueKickMap(v)

      for (const b of bars) {
        // Base wave: spatial offset by bar index, time advances phase
        const phase = b.indexU * Math.PI * 2 - (now / PULSE_PERIOD) * Math.PI * 2
        const wave = (Math.sin(phase) + 1) / 2 // 0..1

        // Spotlight: bars near mouseX get an additive bonus
        const dist = Math.abs(b.indexU - mx)
        const spotlight = spotlightMap(dist)

        const hMax = H * 0.7 * ampScale
        const hMin = H * 0.06
        const u = Math.min(1, wave * 0.6 + spotlight * 0.6)
        const barH = hMin + (hMax - hMin) * u
        b.el.setAttribute("y", (baseline - barH).toFixed(2))
        b.el.setAttribute("height", barH.toFixed(2))

        // Hue: cycles slowly with time, shifts per bar, kicked by cursor velocity,
        // and warmed under the spotlight so the cursor's neighbourhood reads
        // visibly distinct from the rest of the spectrum.
        const hue = (b.indexU * 80 + now / 60 + hueKick + spotlight * 60) % 360
        const sat = 70 + u * 25
        const light = 38 + u * 30
        b.el.setAttribute("fill", `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`)
      }
    }
    renderAll()

    // Subscribe once per source. Any change re-renders everything; the
    // render loop is cheap (28 bars, no DOM allocation) and keeps the
    // reactive-graph story simple to read in the source.
    const offT = t.on(renderAll)
    const offX = mouseX.on(renderAll)
    const offY = mouseY.on(renderAll)
    const offV = vx.on(renderAll)

    // Hint label so the cursor interaction is discoverable.
    const hint = document.createElement("div")
    Object.assign(hint.style, {
      position: "absolute",
      top: "16px",
      right: "20px",
      padding: "6px 12px",
      borderRadius: "999px",
      background: "rgba(8, 6, 22, 0.55)",
      border: "1px solid rgba(160, 130, 255, 0.18)",
      color: "#cdbcff",
      font: "12px ui-sans-serif, system-ui",
      pointerEvents: "none",
      backdropFilter: "blur(6px)",
    })
    hint.textContent = "Move the cursor over the bars"
    wrap.appendChild(hint)

    // Live readout of the four reactive sources.
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
      minWidth: "190px",
    })
    readout.innerHTML = `
      <div style="opacity: 0.6; margin-bottom: 4px">reactive sources</div>
      <div>time()&nbsp;&nbsp;&nbsp;<span data-k="t">0</span> ms</div>
      <div>mouseX&nbsp;&nbsp;<span data-k="x">0.500</span></div>
      <div>mouseY&nbsp;&nbsp;<span data-k="y">0.500</span></div>
      <div>velocity&nbsp;<span data-k="v">+0.0000</span></div>
    `
    wrap.appendChild(readout)
    const tCell = readout.querySelector('[data-k="t"]') as HTMLElement
    const xCell = readout.querySelector('[data-k="x"]') as HTMLElement
    const yCell = readout.querySelector('[data-k="y"]') as HTMLElement
    const vCell = readout.querySelector('[data-k="v"]') as HTMLElement

    const offRT = t.on((value) => {
      tCell.textContent = String(Math.round(value))
    })
    const offRX = mouseX.on((value) => {
      xCell.textContent = value.toFixed(3)
    })
    const offRY = mouseY.on((value) => {
      yCell.textContent = value.toFixed(3)
    })
    const offRV = vx.on((value) => {
      const sign = value >= 0 ? "+" : ""
      vCell.textContent = `${sign}${value.toFixed(4)}`
    })

    const onMove = (ev: PointerEvent): void => {
      const rect = wrap.getBoundingClientRect()
      mouseX.set(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)))
      mouseY.set(Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height)))
    }
    const onLeave = (): void => {
      mouseX.set(0.5)
      mouseY.set(0.5)
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    return () => {
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      offT()
      offX()
      offY()
      offV()
      offRT()
      offRX()
      offRY()
      offRV()
      vx.destroy()
      mouseX.destroy()
      mouseY.destroy()
      t.destroy()
    }
  },
}
