import { playCanvas, splitText, spring } from "@kinem/core"
import type { Demo } from "../demo"

export const textShatter: Demo = {
  id: "text-shatter",
  title: "Text shatter on hover",
  blurb:
    "Hover the headline. Letters fly apart with per-char spring physics, then reassemble when the pointer leaves.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 40%, #151a2a 0%, #07080b 70%)",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const h = document.createElement("div")
    h.textContent = "Break it apart."
    Object.assign(h.style, {
      font: "700 84px/1 ui-sans-serif, system-ui, sans-serif",
      letterSpacing: "-0.03em",
      textAlign: "center",
      background: "linear-gradient(180deg, #e8ecf4 0%, #7c9cff 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      cursor: "default",
      userSelect: "none",
      padding: "0 24px",
    })
    wrap.appendChild(h)

    const split = splitText(h, { by: ["chars"] })
    const chars = split.chars

    interface CharState {
      dx: number
      dy: number
      rot: number
      scale: number
      targetDx: number
      targetDy: number
      targetRot: number
      targetScale: number
      playing: ReturnType<typeof playCanvas> | null
    }

    const states: CharState[] = chars.map((c) => {
      c.style.display = "inline-block"
      c.style.willChange = "transform"
      return {
        dx: 0,
        dy: 0,
        rot: 0,
        scale: 1,
        targetDx: 0,
        targetDy: 0,
        targetRot: 0,
        targetScale: 1,
        playing: null,
      }
    })

    const apply = (i: number): void => {
      const c = chars[i]
      const s = states[i]
      if (!c || !s) return
      c.style.transform = `translate(${s.dx}px, ${s.dy}px) rotate(${s.rot}deg) scale(${s.scale})`
    }

    const shatter = (): void => {
      chars.forEach((_, i) => {
        const s = states[i]
        if (!s) return
        s.targetDx = (Math.random() - 0.5) * 400
        s.targetDy = (Math.random() - 0.5) * 300
        s.targetRot = (Math.random() - 0.5) * 180
        s.targetScale = 0.6 + Math.random() * 0.6
        s.playing?.cancel()
        const fromDx = s.dx
        const fromDy = s.dy
        const fromRot = s.rot
        const fromScale = s.scale
        s.playing = playCanvas(
          spring(
            {
              dx: [fromDx, s.targetDx],
              dy: [fromDy, s.targetDy],
              rot: [fromRot, s.targetRot],
              sc: [fromScale, s.targetScale],
            },
            { stiffness: 180, damping: 14 },
          ),
          (v) => {
            s.dx = v.dx
            s.dy = v.dy
            s.rot = v.rot
            s.scale = v.sc
            apply(i)
          },
        )
      })
    }

    const reform = (): void => {
      chars.forEach((_, i) => {
        const s = states[i]
        if (!s) return
        s.playing?.cancel()
        const fromDx = s.dx
        const fromDy = s.dy
        const fromRot = s.rot
        const fromScale = s.scale
        s.playing = playCanvas(
          spring(
            {
              dx: [fromDx, 0],
              dy: [fromDy, 0],
              rot: [fromRot, 0],
              sc: [fromScale, 1],
            },
            { stiffness: 260, damping: 22 },
          ),
          (v) => {
            s.dx = v.dx
            s.dy = v.dy
            s.rot = v.rot
            s.scale = v.sc
            apply(i)
          },
        )
      })
    }

    h.addEventListener("pointerenter", shatter)
    h.addEventListener("pointerleave", reform)

    return () => {
      h.removeEventListener("pointerenter", shatter)
      h.removeEventListener("pointerleave", reform)
      states.forEach((s) => s.playing?.cancel())
      split.revert()
    }
  },
}
