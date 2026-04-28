import { type ValuesHandle, gesture, inertia, playValues, spring } from "@kinem/core"
import type { Demo } from "../demo"

const DRAG_SCALE_SENSITIVITY = 0.005
const DRAG_ROTATE_SENSITIVITY = 0.005

const MIN_SCALE = 0.5
const MAX_SCALE = 4

const VEL_WINDOW_MS = 80
const FLING_THRESHOLD = 0.4 // |dscale/sec|, below this we just snapback

export const pinchZoom: Demo = {
  id: "pinch-zoom",
  title: "Pinch → zoom with inertia",
  blurb:
    "Two-finger pinch scales and rotates. Release past bounds and it springs back. Use trackpad pinch too.",
  group: "Gesture",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "#07080b",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const photo = document.createElement("div")
    Object.assign(photo.style, {
      width: "360px",
      height: "480px",
      borderRadius: "12px",
      background:
        "conic-gradient(from 0deg at 50% 50%, #f59e0b, #ef4444, #ec4899, #8b5cf6, #3b82f6, #10b981, #f59e0b)",
      filter: "saturate(1.1) contrast(1.05)",
      boxShadow: "0 40px 120px rgba(139,92,246,0.3), 0 0 0 1px rgba(255,255,255,0.08)",
      touchAction: "none",
      willChange: "transform",
      transformOrigin: "center center",
      position: "relative",
    })
    wrap.appendChild(photo)

    const hint = document.createElement("div")
    hint.textContent = "PINCH · DRAG · WHEEL"
    Object.assign(hint.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      color: "rgba(255,255,255,0.85)",
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "0.28em",
      pointerEvents: "none",
      textShadow: "0 1px 4px rgba(0,0,0,0.4)",
    })
    photo.appendChild(hint)

    let scale = 1
    let rotation = 0
    let baseScale = 1
    let baseRotation = 0
    let activePlay: ValuesHandle | null = null

    const apply = (): void => {
      photo.style.transform = `scale(${scale}) rotate(${rotation}rad)`
    }

    // Sliding-window velocity tracker for scale and rotation. We can't
    // use createVelocityTracker (Cartesian x/y) directly, so roll our own
    // 1D variant that returns rate-of-change in units/sec.
    interface Sample {
      readonly s: number
      readonly r: number
      readonly t: number
    }
    const samples: Sample[] = []
    const recordSample = (s: number, r: number): void => {
      const t = performance.now()
      samples.push({ s, r, t })
      const cutoff = t - VEL_WINDOW_MS
      while (samples.length > 0 && (samples[0] as Sample).t < cutoff) samples.shift()
    }
    const resetSamples = (): void => {
      samples.length = 0
    }
    const velocityPerSec = (): { vScale: number; vRot: number } => {
      if (samples.length < 2) return { vScale: 0, vRot: 0 }
      const first = samples[0] as Sample
      const last = samples[samples.length - 1] as Sample
      const dt = (last.t - first.t) / 1000
      if (dt <= 0) return { vScale: 0, vRot: 0 }
      return { vScale: (last.s - first.s) / dt, vRot: (last.r - first.r) / dt }
    }

    // Release behavior is shared between pinch and pan. With nontrivial
    // velocity we glide via `inertia` (clamped to the scale bounds);
    // otherwise we just spring back to the nearest clamped scale. Either
    // way the release goes through `playValues` so it shows up in the
    // devtools panel.
    const driveRelease = (): void => {
      const { vScale, vRot } = velocityPerSec()
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
      const fastFling = Math.abs(vScale) > FLING_THRESHOLD

      if (fastFling) {
        // restDelta is in scale-units. 0.005 stops the formal animation
        // around the moment the human eye stops noticing further drift,
        // so the panel "playing" lifetime tracks the visible motion
        // instead of dragging on into the long exponential tail.
        const def = inertia(
          { s: [scale, vScale], r: [rotation, vRot] },
          {
            bounds: { s: [MIN_SCALE, MAX_SCALE] },
            timeConstant: 240,
            power: 0.85,
            restDelta: 0.005,
          },
        )
        activePlay = playValues(def, (v) => {
          scale = v.s
          rotation = v.r
          apply()
        })
        return
      }

      if (clampedScale !== scale) {
        const def = spring({ s: [scale, clampedScale] }, { stiffness: 180, damping: 16 })
        activePlay = playValues(def, (v) => {
          scale = v.s
          apply()
        })
      }
    }

    const pinchHandle = gesture.pinch(photo, {
      onStart: () => {
        activePlay?.cancel()
        baseScale = scale
        baseRotation = rotation
        resetSamples()
        recordSample(scale, rotation)
      },
      onChange: (ev) => {
        scale = Math.max(MIN_SCALE * 0.8, Math.min(MAX_SCALE * 1.2, baseScale * ev.scale))
        rotation = baseRotation + ev.rotation
        recordSample(scale, rotation)
        apply()
      },
      onEnd: driveRelease,
    })

    // Mouse-friendly fallback: drag the photo. Vertical → scale,
    // horizontal → rotation. Works alongside pinch (different pointer count).
    let dragBaseScale = 1
    let dragBaseRotation = 0
    const dragHandle = gesture.pan(photo, {
      onStart: () => {
        activePlay?.cancel()
        dragBaseScale = scale
        dragBaseRotation = rotation
        resetSamples()
        recordSample(scale, rotation)
      },
      onMove: (ev) => {
        scale = Math.max(
          MIN_SCALE * 0.8,
          Math.min(
            MAX_SCALE * 1.2,
            dragBaseScale * Math.exp(-ev.offset.y * DRAG_SCALE_SENSITIVITY),
          ),
        )
        rotation = dragBaseRotation + ev.offset.x * DRAG_ROTATE_SENSITIVITY
        recordSample(scale, rotation)
        apply()
      },
      onEnd: driveRelease,
    })

    // Trackpad pinch and ctrl+wheel: browsers report pinch as ctrlKey + wheel.
    // Plain wheel scrolls the page; we only hijack the gesture form.
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      activePlay?.cancel()
      const factor = Math.exp(-e.deltaY * 0.01)
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor))
      apply()
    }
    wrap.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      pinchHandle.cancel()
      dragHandle.cancel()
      activePlay?.cancel()
      wrap.removeEventListener("wheel", onWheel)
    }
  },
}
