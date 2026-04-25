import { easeOut, gesture, play, tween } from "@kinem/core"
import type { Demo } from "../demo"

const HUES = [210, 280, 320, 160, 40]
let hueIdx = 0

export const tapRipple: Demo = {
  id: "tap-ripple",
  title: "Tap → ripple burst",
  blurb: "Tap anywhere. Each tap spawns a ripple that scales out and fades, plus a shockwave ring.",
  group: "Gesture",
  mount(stage) {
    const surface = document.createElement("div")
    Object.assign(surface.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(circle at 50% 60%, #111624 0%, #07080b 60%), repeating-linear-gradient(0deg, transparent 0 31px, rgba(124,156,255,0.04) 31px 32px), repeating-linear-gradient(90deg, transparent 0 31px, rgba(124,156,255,0.04) 31px 32px)",
      cursor: "crosshair",
      overflow: "hidden",
    })
    stage.appendChild(surface)

    const hint = document.createElement("div")
    hint.textContent = "tap anywhere"
    Object.assign(hint.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      color: "rgba(232,236,244,0.25)",
      fontSize: "14px",
      letterSpacing: "0.24em",
      textTransform: "uppercase",
      pointerEvents: "none",
      fontWeight: "500",
    })
    surface.appendChild(hint)

    const spawn = (x: number, y: number): void => {
      const rect = surface.getBoundingClientRect()
      const localX = x - rect.left
      const localY = y - rect.top
      const hue = HUES[hueIdx++ % HUES.length] ?? 210

      // Inner filled disc
      const disc = document.createElement("div")
      Object.assign(disc.style, {
        position: "absolute",
        left: `${localX}px`,
        top: `${localY}px`,
        width: "40px",
        height: "40px",
        marginLeft: "-20px",
        marginTop: "-20px",
        borderRadius: "50%",
        background: `radial-gradient(circle, hsla(${hue}, 90%, 70%, 0.9) 0%, hsla(${hue}, 90%, 60%, 0) 70%)`,
        pointerEvents: "none",
        willChange: "transform, opacity",
      })
      surface.appendChild(disc)

      // Outer shockwave ring
      const ring = document.createElement("div")
      Object.assign(ring.style, {
        position: "absolute",
        left: `${localX}px`,
        top: `${localY}px`,
        width: "40px",
        height: "40px",
        marginLeft: "-20px",
        marginTop: "-20px",
        borderRadius: "50%",
        border: `2px solid hsla(${hue}, 90%, 70%, 0.9)`,
        pointerEvents: "none",
        willChange: "transform, opacity",
      })
      surface.appendChild(ring)

      const discCtl = play(
        tween({ scale: [1, 5], opacity: [0.9, 0] }, { duration: 700, easing: easeOut }),
        disc,
      )
      discCtl.finished.then(() => disc.remove()).catch(() => {})
      const ringCtl = play(
        tween({ scale: [1, 9], opacity: [0.8, 0] }, { duration: 900, easing: easeOut }),
        ring,
      )
      ringCtl.finished.then(() => ring.remove()).catch(() => {})

      if (hint.parentNode) {
        const hintCtl = play(
          tween({ opacity: [Number(hint.style.opacity || "1"), 0] }, { duration: 300 }),
          hint,
        )
        hintCtl.finished.then(() => hint.remove()).catch(() => {})
      }
    }

    const tapHandle = gesture.tap(surface, {
      onTap: (ev) => spawn(ev.point.x, ev.point.y),
    })

    return () => {
      tapHandle.cancel()
    }
  },
}
