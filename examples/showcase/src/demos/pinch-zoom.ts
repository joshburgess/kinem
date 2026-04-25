import { gesture, playCanvas, spring } from "@kinem/core"
import type { Demo } from "../demo"

const DRAG_SCALE_SENSITIVITY = 0.005
const DRAG_ROTATE_SENSITIVITY = 0.005

const MIN_SCALE = 0.5
const MAX_SCALE = 4

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
    let activePlay: ReturnType<typeof playCanvas> | null = null

    const apply = (): void => {
      photo.style.transform = `scale(${scale}) rotate(${rotation}rad)`
    }

    const pinchHandle = gesture.pinch(photo, {
      onStart: () => {
        activePlay?.cancel()
        baseScale = scale
        baseRotation = rotation
      },
      onChange: (ev) => {
        scale = Math.max(MIN_SCALE * 0.8, Math.min(MAX_SCALE * 1.2, baseScale * ev.scale))
        rotation = baseRotation + ev.rotation
        apply()
      },
      onEnd: () => {
        // Spring to clamped range
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
        if (clamped !== scale) {
          const from = scale
          activePlay = playCanvas(
            spring({ s: [from, clamped] }, { stiffness: 180, damping: 16 }),
            (v) => {
              scale = v.s
              apply()
            },
          )
        }
      },
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
      },
      onMove: (ev) => {
        scale = Math.max(
          MIN_SCALE * 0.8,
          Math.min(MAX_SCALE * 1.2, dragBaseScale * Math.exp(-ev.offset.y * DRAG_SCALE_SENSITIVITY)),
        )
        rotation = dragBaseRotation + ev.offset.x * DRAG_ROTATE_SENSITIVITY
        apply()
      },
      onEnd: () => {
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
        if (clamped !== scale) {
          const from = scale
          activePlay = playCanvas(
            spring({ s: [from, clamped] }, { stiffness: 180, damping: 16 }),
            (v) => {
              scale = v.s
              apply()
            },
          )
        }
      },
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
