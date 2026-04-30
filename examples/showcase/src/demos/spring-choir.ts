import { motionValue, time, trackNamed } from "@kinem/core"
import type { Demo } from "../demo"

const SVG_NS = "http://www.w3.org/2000/svg"
const W = 720
const H = 460
const ROW_H = 56
const PAD_X = 60
const PAD_Y = 30
const TRACK_X0 = PAD_X + 110 // leave room for the per-row label on the left

interface Follower {
  readonly stiffness: number
  readonly label: string
  readonly hue: number
  position: number
  readonly el: SVGCircleElement
  readonly trail: SVGRectElement
}

export const springChoir: Demo = {
  id: "spring-choir",
  title: "Spring choir reactive followers",
  blurb:
    "Drag the leader puck. Five followers chase its position with different per-frame lerp factors. A single motionValue holds the leader's x; a time() listener drives every row's update step from one tick. The same source fans out into five independent derived states, so spring tuning differences read at a glance.",
  group: "Reactive values",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 60%, #0c1220 0%, #050810 55%, #02030a 100%)",
      overflow: "hidden",
      cursor: "default",
    })
    stage.appendChild(wrap)

    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("width", String(W))
    svg.setAttribute("height", String(H))
    Object.assign(svg.style, {
      filter: "drop-shadow(0 14px 60px rgba(80, 130, 220, 0.30))",
      maxWidth: "92vw",
      height: "auto",
      touchAction: "none",
    })
    wrap.appendChild(svg)

    const trackW = W - TRACK_X0 - PAD_X

    // One named entry in devtools so this demo shows up as a single
    // labelled record while it is mounted, instead of being invisible.
    const offTrack = trackNamed("spring-choir")

    // Reactive sources.
    //  - leaderX: the cursor's drag position, normalized to [0, 1]
    //  - t: the rAF tick. Subscribing to it gives every row the same heartbeat
    //    without each row owning its own raf loop.
    const leaderX = motionValue(0.5)
    const t = time()

    // Leader row (top).
    const leaderY = PAD_Y + ROW_H / 2
    const leaderTrack = document.createElementNS(SVG_NS, "rect")
    leaderTrack.setAttribute("x", String(TRACK_X0))
    leaderTrack.setAttribute("y", String(leaderY - 3))
    leaderTrack.setAttribute("width", String(trackW))
    leaderTrack.setAttribute("height", "6")
    leaderTrack.setAttribute("rx", "3")
    leaderTrack.setAttribute("fill", "rgba(180, 200, 255, 0.18)")
    svg.appendChild(leaderTrack)

    const leaderLabel = document.createElementNS(SVG_NS, "text")
    leaderLabel.setAttribute("x", String(PAD_X))
    leaderLabel.setAttribute("y", String(leaderY + 4))
    leaderLabel.setAttribute("fill", "#cdd9ff")
    leaderLabel.setAttribute("font-family", "ui-sans-serif, system-ui")
    leaderLabel.setAttribute("font-size", "13")
    leaderLabel.setAttribute("font-weight", "600")
    leaderLabel.textContent = "leader"
    svg.appendChild(leaderLabel)

    const leaderPuck = document.createElementNS(SVG_NS, "circle")
    leaderPuck.setAttribute("r", "14")
    leaderPuck.setAttribute("cy", String(leaderY))
    leaderPuck.setAttribute("fill", "#e7eeff")
    leaderPuck.setAttribute("stroke", "rgba(140, 170, 255, 0.6)")
    leaderPuck.setAttribute("stroke-width", "2")
    leaderPuck.style.cursor = "grab"
    svg.appendChild(leaderPuck)

    // Five followers with stiffness across two orders of magnitude. The
    // hues march from cool to warm so a glance at the colour gives you a
    // sense of where each row sits on the responsiveness scale.
    const followers: Follower[] = [
      { stiffness: 0.03, label: "stiffness 0.03", hue: 215, position: 0.5 },
      { stiffness: 0.08, label: "stiffness 0.08", hue: 190, position: 0.5 },
      { stiffness: 0.16, label: "stiffness 0.16", hue: 150, position: 0.5 },
      { stiffness: 0.32, label: "stiffness 0.32", hue: 50, position: 0.5 },
      { stiffness: 0.64, label: "stiffness 0.64", hue: 15, position: 0.5 },
    ].map((f, i) => {
      const cy = PAD_Y + ROW_H * (i + 1) + ROW_H / 2 + 14

      const trail = document.createElementNS(SVG_NS, "rect")
      trail.setAttribute("x", String(TRACK_X0))
      trail.setAttribute("y", String(cy - 1))
      trail.setAttribute("width", "0")
      trail.setAttribute("height", "2")
      trail.setAttribute("rx", "1")
      trail.setAttribute("fill", `hsl(${f.hue} 80% 60%)`)
      trail.setAttribute("opacity", "0.55")
      svg.appendChild(trail)

      const baseline = document.createElementNS(SVG_NS, "line")
      baseline.setAttribute("x1", String(TRACK_X0))
      baseline.setAttribute("x2", String(TRACK_X0 + trackW))
      baseline.setAttribute("y1", String(cy))
      baseline.setAttribute("y2", String(cy))
      baseline.setAttribute("stroke", "rgba(255, 255, 255, 0.06)")
      baseline.setAttribute("stroke-dasharray", "2 4")
      svg.appendChild(baseline)

      const label = document.createElementNS(SVG_NS, "text")
      label.setAttribute("x", String(PAD_X))
      label.setAttribute("y", String(cy + 4))
      label.setAttribute("fill", `hsl(${f.hue} 65% 75%)`)
      label.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace")
      label.setAttribute("font-size", "12")
      label.textContent = f.label
      svg.appendChild(label)

      const el = document.createElementNS(SVG_NS, "circle")
      el.setAttribute("r", "11")
      el.setAttribute("cy", String(cy))
      el.setAttribute("fill", `hsl(${f.hue} 80% 60%)`)
      el.setAttribute("stroke", `hsl(${f.hue} 80% 80%)`)
      el.setAttribute("stroke-width", "1.5")
      svg.appendChild(el)

      return { ...f, el, trail }
    })

    const xAt = (u: number): number => TRACK_X0 + u * trackW

    // Initial paint.
    leaderPuck.setAttribute("cx", String(xAt(leaderX.get())))
    for (const f of followers) {
      f.el.setAttribute("cx", String(xAt(f.position)))
    }

    // Reactive update step. Time tick fires every rAF. When the user
    // isn't dragging, the leader auto-oscillates as a sine wave so the
    // differential lag between rows is always visible without input;
    // dragging takes over by setting `manual = true` which suspends the
    // oscillation until pointerup.
    let manual = false
    const offT = t.on((now) => {
      if (!manual) {
        const u = 0.5 + 0.45 * Math.sin(now / 1400)
        leaderX.set(u)
      }
      const target = leaderX.get()
      leaderPuck.setAttribute("cx", String(xAt(target)))
      for (const f of followers) {
        f.position += (target - f.position) * f.stiffness
        const cx = xAt(f.position)
        f.el.setAttribute("cx", String(cx))
        // The "trail" is a thin coloured bar between the leader and the
        // follower; its length encodes the per-row lag.
        const lo = Math.min(cx, xAt(target))
        const hi = Math.max(cx, xAt(target))
        f.trail.setAttribute("x", String(lo))
        f.trail.setAttribute("width", String(hi - lo))
      }
    })

    // Drag handling on the SVG track. A pointerdown anywhere on the
    // leader row sets the position immediately; subsequent pointermoves
    // while held update the source MV continuously. While dragging, the
    // auto-oscillation is suppressed via `manual`.
    let dragging = false
    const setFromPointer = (clientX: number): void => {
      const rect = svg.getBoundingClientRect()
      const u = (clientX - rect.left) / rect.width
      const trackU0 = TRACK_X0 / W
      const trackU1 = (TRACK_X0 + trackW) / W
      const v = (u - trackU0) / (trackU1 - trackU0)
      leaderX.set(Math.max(0, Math.min(1, v)))
    }
    const onDown = (ev: PointerEvent): void => {
      dragging = true
      manual = true
      ;(svg as unknown as Element & { setPointerCapture(id: number): void }).setPointerCapture(
        ev.pointerId,
      )
      leaderPuck.style.cursor = "grabbing"
      setFromPointer(ev.clientX)
    }
    const onMove = (ev: PointerEvent): void => {
      if (!dragging) return
      setFromPointer(ev.clientX)
    }
    const onUp = (): void => {
      dragging = false
      // Resume auto-oscillation a moment after release so the user can
      // see their final position settle before the leader takes off.
      setTimeout(() => {
        if (!dragging) manual = false
      }, 700)
      leaderPuck.style.cursor = "grab"
    }
    svg.addEventListener("pointerdown", onDown)
    svg.addEventListener("pointermove", onMove)
    svg.addEventListener("pointerup", onUp)
    svg.addEventListener("pointercancel", onUp)

    // Discoverability hint and a live readout of the source MV.
    const hint = document.createElement("div")
    Object.assign(hint.style, {
      position: "absolute",
      top: "16px",
      right: "20px",
      padding: "6px 12px",
      borderRadius: "999px",
      background: "rgba(8, 12, 28, 0.55)",
      border: "1px solid rgba(160, 180, 255, 0.18)",
      color: "#cdd9ff",
      font: "12px ui-sans-serif, system-ui",
      pointerEvents: "none",
      backdropFilter: "blur(6px)",
    })
    hint.textContent = "Drag the leader puck or watch it oscillate"
    wrap.appendChild(hint)

    const readout = document.createElement("div")
    Object.assign(readout.style, {
      position: "absolute",
      left: "16px",
      bottom: "16px",
      padding: "10px 14px",
      borderRadius: "10px",
      background: "rgba(8, 12, 28, 0.55)",
      border: "1px solid rgba(160, 180, 255, 0.18)",
      color: "#cdd9ff",
      font: "12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
      backdropFilter: "blur(6px)",
      pointerEvents: "none",
      minWidth: "180px",
    })
    readout.innerHTML = `
      <div style="opacity: 0.6; margin-bottom: 4px">reactive sources</div>
      <div>leaderX&nbsp;<span data-k="x">0.500</span></div>
      <div>time()&nbsp;&nbsp;&nbsp;<span data-k="t">0</span> ms</div>
    `
    wrap.appendChild(readout)
    const xCell = readout.querySelector('[data-k="x"]') as HTMLElement
    const tCell = readout.querySelector('[data-k="t"]') as HTMLElement
    const offRX = leaderX.on((value) => {
      xCell.textContent = value.toFixed(3)
    })
    const offRT = t.on((value) => {
      tCell.textContent = String(Math.round(value))
    })

    return () => {
      svg.removeEventListener("pointerdown", onDown)
      svg.removeEventListener("pointermove", onMove)
      svg.removeEventListener("pointerup", onUp)
      svg.removeEventListener("pointercancel", onUp)
      offT()
      offRX()
      offRT()
      leaderX.destroy()
      t.destroy()
      offTrack()
    }
  },
}
