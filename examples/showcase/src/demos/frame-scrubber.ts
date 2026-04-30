import { keyframes, motionValue, scrub, trackNamed } from "@kinem/core"
import type { Demo } from "../demo"

interface Marker {
  readonly name: string
  readonly offset: number
  readonly hint: string
}

// Five named beats. The keyframes def below uses these exact offsets so
// that landing on a marker matches its label one-to-one.
const MARKERS: readonly Marker[] = [
  { name: "rest", offset: 0.0, hint: "settled, low energy" },
  { name: "leap", offset: 0.25, hint: "lifts off the floor" },
  { name: "peak", offset: 0.5, hint: "apex, full rotation" },
  { name: "twist", offset: 0.75, hint: "drifts back, spins out" },
  { name: "land", offset: 1.0, hint: "rest, far side" },
]

export const frameScrubber: Demo = {
  id: "frame-scrubber",
  title: "Frame scrubber · push & pull",
  blurb:
    "A multi-stop keyframes def applied to a hero token, driven by scrub(). Drag the timeline knob to push progress directly into the handle; hit play to switch to pull-mode where scrub polls a source signal each frame. Click any marker to seek, and the trail samples earlier progress so the path stays visible.",
  group: "Reactive values",
  mount(stage) {
    const offTrack = trackNamed("frame-scrubber")

    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 35%, #14182c 0%, #0a0c1a 55%, #04050d 100%)",
      userSelect: "none",
      touchAction: "none",
    })
    stage.appendChild(wrap)

    // Stage area where the hero moves. We work in a local coordinate
    // space so the keyframe values are independent of viewport size.
    const arena = document.createElement("div")
    Object.assign(arena.style, {
      position: "absolute",
      left: "50%",
      top: "44%",
      width: "0",
      height: "0",
      pointerEvents: "none",
    })
    wrap.appendChild(arena)

    // A faint horizontal guide rail.
    const rail = document.createElement("div")
    Object.assign(rail.style, {
      position: "absolute",
      left: "-220px",
      top: "60px",
      width: "440px",
      height: "1px",
      background:
        "linear-gradient(90deg, transparent 0%, rgba(180,200,255,0.18) 20%, rgba(180,200,255,0.18) 80%, transparent 100%)",
      pointerEvents: "none",
    })
    arena.appendChild(rail)

    // Trail dots that sample the timeline at fixed lookback offsets, so
    // you see the recent path behind the hero. Each one runs an
    // independent scrub() handle reading the same shared progress cell.
    const TRAIL_COUNT = 6
    const trails: HTMLDivElement[] = []
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const t = i / TRAIL_COUNT
      const dot = document.createElement("div")
      Object.assign(dot.style, {
        position: "absolute",
        left: "-9px",
        top: "-9px",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, hsla(220, 90%, 80%, ${0.65 - t * 0.55}), hsla(260, 80%, 55%, ${0.45 - t * 0.4}))`,
        boxShadow: `0 0 ${14 - t * 10}px hsla(230, 90%, 70%, ${0.4 - t * 0.35})`,
        pointerEvents: "none",
        willChange: "transform",
      })
      arena.appendChild(dot)
      trails.push(dot)
    }

    const hero = document.createElement("div")
    Object.assign(hero.style, {
      position: "absolute",
      left: "-22px",
      top: "-22px",
      width: "44px",
      height: "44px",
      borderRadius: "12px",
      background:
        "radial-gradient(circle at 30% 25%, #fff, #ffe7a8 35%, #f59e0b 70%, #b45309 100%)",
      boxShadow: "0 0 28px rgba(251,191,36,0.7), 0 0 70px rgba(244,114,182,0.35)",
      pointerEvents: "none",
      willChange: "transform",
    })
    arena.appendChild(hero)

    // The timeline. x sweeps -200 to 200; y arches up at peak; rotate
    // does a full revolution by land; scale pulses at peak. Offsets line
    // up with MARKERS so seeking a label snaps cleanly to its stop.
    const timeline = keyframes(
      {
        x: [-200, -100, 0, 100, 200],
        y: [0, -40, -90, -40, 0],
        rotate: [0, 90, 180, 270, 360],
        scale: [1, 1.05, 1.18, 1.05, 1],
      },
      { offsets: [0, 0.25, 0.5, 0.75, 1] },
    )

    // The shared progress cell. UI inputs (drag, click, play) mutate
    // this; scrub handles read from it via opts.source in pull mode, or
    // we push directly via setProgress in push mode.
    const progress = motionValue(0)

    // Hero handle. Its source is the live progress cell, so any way the
    // value moves (drag, click, play) the hero updates next frame.
    const heroScrub = scrub(timeline, [], {
      source: () => progress.get(),
      onProgress: (p) => {
        const v = timeline.interpolate(p) as {
          x: number
          y: number
          rotate: number
          scale: number
        }
        hero.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) rotate(${v.rotate}deg) scale(${v.scale})`
      },
    })

    // Trail handles. Each samples a slightly earlier offset so the trail
    // visualises the recent path. Wrapping mod 1 keeps the trail visible
    // even at p=0.02 (it spills back from p=0.92, etc.).
    const trailScrubs = trails.map((dot, i) => {
      const lookback = ((i + 1) / TRAIL_COUNT) * 0.18
      return scrub(timeline, [], {
        source: () => {
          let q = progress.get() - lookback
          q = ((q % 1) + 1) % 1
          return q
        },
        onProgress: (p) => {
          const v = timeline.interpolate(p) as {
            x: number
            y: number
            scale: number
          }
          const s = v.scale * (0.85 - i * 0.08)
          dot.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${s})`
        },
      })
    })

    // Bottom timeline UI.
    const tl = document.createElement("div")
    Object.assign(tl.style, {
      position: "absolute",
      left: "50%",
      bottom: "60px",
      transform: "translateX(-50%)",
      width: "min(640px, 80%)",
      padding: "18px 22px 20px",
      borderRadius: "16px",
      background: "rgba(8, 10, 22, 0.7)",
      border: "1px solid rgba(160, 180, 255, 0.18)",
      backdropFilter: "blur(8px)",
      color: "#cdd9ff",
      font: "12px/1.5 ui-sans-serif, system-ui",
    })
    wrap.appendChild(tl)

    const tlHeader = document.createElement("div")
    Object.assign(tlHeader.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "14px",
    })
    tl.appendChild(tlHeader)

    const tlMode = document.createElement("div")
    tlMode.innerHTML = `<span style="opacity:0.55">mode</span> <span data-k="mode" style="font:600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color:#a8c4ff">push</span>`
    tlHeader.appendChild(tlMode)

    const playBtn = document.createElement("button")
    playBtn.type = "button"
    playBtn.textContent = "play"
    Object.assign(playBtn.style, {
      appearance: "none",
      border: "1px solid rgba(160, 180, 255, 0.3)",
      borderRadius: "8px",
      background: "rgba(40, 60, 120, 0.45)",
      color: "#dde7ff",
      padding: "5px 14px",
      font: "600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
      cursor: "pointer",
    })
    tlHeader.appendChild(playBtn)

    // Scrubber rail.
    const track = document.createElement("div")
    Object.assign(track.style, {
      position: "relative",
      height: "10px",
      borderRadius: "5px",
      background: "rgba(160, 180, 255, 0.12)",
      cursor: "pointer",
    })
    tl.appendChild(track)

    const fill = document.createElement("div")
    Object.assign(fill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      height: "100%",
      width: "0%",
      borderRadius: "5px",
      background: "linear-gradient(90deg, #6ea8ff, #c084fc)",
      pointerEvents: "none",
    })
    track.appendChild(fill)

    const knob = document.createElement("div")
    Object.assign(knob.style, {
      position: "absolute",
      top: "50%",
      left: "0%",
      width: "20px",
      height: "20px",
      marginLeft: "-10px",
      marginTop: "-10px",
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 30%, #fff, #c084fc 60%, #7c3aed 100%)",
      boxShadow: "0 0 14px rgba(192,132,252,0.65)",
      cursor: "grab",
      pointerEvents: "none",
    })
    track.appendChild(knob)

    // Marker pips on the rail.
    const markersRow = document.createElement("div")
    Object.assign(markersRow.style, {
      position: "relative",
      height: "30px",
      marginTop: "10px",
    })
    tl.appendChild(markersRow)
    for (const m of MARKERS) {
      const pip = document.createElement("button")
      pip.type = "button"
      pip.title = m.hint
      pip.textContent = m.name
      Object.assign(pip.style, {
        position: "absolute",
        top: "0",
        left: `${m.offset * 100}%`,
        transform: "translateX(-50%)",
        appearance: "none",
        border: "1px solid rgba(160, 180, 255, 0.22)",
        borderRadius: "999px",
        background: "rgba(20, 28, 56, 0.6)",
        color: "#cdd9ff",
        padding: "3px 10px",
        font: "600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
        cursor: "pointer",
      })
      pip.addEventListener("click", () => {
        progress.set(m.offset)
      })
      markersRow.appendChild(pip)
    }

    // Live readout pinned bottom-left.
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
      <div style="opacity: 0.6; margin-bottom: 4px">scrub state</div>
      <div>progress&nbsp;<span data-k="p">0.000</span></div>
      <div>nearest&nbsp;&nbsp;<span data-k="m">rest</span></div>
    `
    wrap.appendChild(readout)
    const pCell = readout.querySelector('[data-k="p"]') as HTMLElement
    const mCell = readout.querySelector('[data-k="m"]') as HTMLElement
    const modeCell = tl.querySelector('[data-k="mode"]') as HTMLElement

    const nearestMarker = (p: number): string => {
      let best = MARKERS[0] as Marker
      let bestD = Math.abs(p - best.offset)
      for (const m of MARKERS) {
        const d = Math.abs(p - m.offset)
        if (d < bestD) {
          best = m
          bestD = d
        }
      }
      return best.name
    }

    const offReadout = progress.on((value) => {
      pCell.textContent = value.toFixed(3)
      mCell.textContent = nearestMarker(value)
      const pct = `${value * 100}%`
      fill.style.width = pct
      knob.style.left = pct
    })
    // Seed initial UI from the starting cell value.
    pCell.textContent = "0.000"
    mCell.textContent = "rest"

    // Drag-to-scrub.
    let dragging = false
    const setFromClientX = (clientX: number): void => {
      const rect = track.getBoundingClientRect()
      const p = (clientX - rect.left) / rect.width
      progress.set(p < 0 ? 0 : p > 1 ? 1 : p)
    }
    const onDown = (e: PointerEvent): void => {
      dragging = true
      knob.style.cursor = "grabbing"
      // Drag implies manual control: bail out of pull mode if engaged.
      stopPull()
      setFromClientX(e.clientX)
      track.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return
      setFromClientX(e.clientX)
    }
    const onUp = (e: PointerEvent): void => {
      dragging = false
      knob.style.cursor = "grab"
      try {
        track.releasePointerCapture(e.pointerId)
      } catch {
        // capture may have already released; harmless.
      }
    }
    track.addEventListener("pointerdown", onDown)
    track.addEventListener("pointermove", onMove)
    track.addEventListener("pointerup", onUp)
    track.addEventListener("pointercancel", onUp)

    // Pull-mode (auto-play). One cycle every 4s; we mutate the same
    // progress cell so the scrub source returns the updated value next
    // frame. Toggling off does not cancel the heroScrub: its source still
    // reads progress.get(), which now stays where the user left it.
    let playRaf = 0
    let playStart = 0
    let playFrom = 0
    let playing = false
    const PLAY_DURATION = 4000

    const startPull = (): void => {
      playing = true
      modeCell.textContent = "pull"
      playBtn.textContent = "pause"
      playFrom = progress.get()
      playStart = performance.now()
      const tick = (): void => {
        if (!playing) return
        const elapsed = (performance.now() - playStart) / PLAY_DURATION
        let p = playFrom + elapsed
        // Loop the auto-play so it doesn't stick at 1.
        p = p - Math.floor(p)
        progress.set(p)
        playRaf = requestAnimationFrame(tick)
      }
      playRaf = requestAnimationFrame(tick)
    }
    const stopPull = (): void => {
      if (!playing) return
      playing = false
      modeCell.textContent = "push"
      playBtn.textContent = "play"
      cancelAnimationFrame(playRaf)
      playRaf = 0
    }
    playBtn.addEventListener("click", () => {
      if (playing) stopPull()
      else startPull()
    })

    return () => {
      stopPull()
      heroScrub.cancel()
      for (const s of trailScrubs) s.cancel()
      track.removeEventListener("pointerdown", onDown)
      track.removeEventListener("pointermove", onMove)
      track.removeEventListener("pointerup", onUp)
      track.removeEventListener("pointercancel", onUp)
      offReadout()
      progress.destroy()
      offTrack()
    }
  },
}
