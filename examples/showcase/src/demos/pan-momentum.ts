import { gesture, type play, playValues, spring, tween } from "@kinem/core"
import type { Demo } from "../demo"

export const panMomentum: Demo = {
  id: "pan-momentum",
  title: "Pan → momentum & snap-back",
  blurb:
    "Drag the card and fling it. Soft flings snap home; hard flings throw in the direction of velocity.",
  group: "Gesture",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 30%, #0f1628 0%, #07080b 70%)",
    })
    stage.appendChild(wrap)

    const card = document.createElement("div")
    Object.assign(card.style, {
      width: "260px",
      height: "340px",
      borderRadius: "20px",
      background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
      boxShadow: "0 30px 80px rgba(99,102,241,0.4), 0 10px 30px rgba(236,72,153,0.25)",
      cursor: "grab",
      touchAction: "none",
      willChange: "transform",
      position: "relative",
      overflow: "hidden",
    })
    wrap.appendChild(card)

    const shine = document.createElement("div")
    Object.assign(shine.style, {
      position: "absolute",
      inset: "0",
      background:
        "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)",
      pointerEvents: "none",
      transform: "translateX(-100%)",
      transition: "transform 1.2s ease-out",
    })
    card.appendChild(shine)

    const label = document.createElement("div")
    label.textContent = "FLING ME"
    Object.assign(label.style, {
      position: "absolute",
      left: "24px",
      bottom: "24px",
      color: "white",
      fontSize: "20px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textShadow: "0 2px 12px rgba(0,0,0,0.3)",
    })
    card.appendChild(label)

    let x = 0
    let y = 0
    let rot = 0
    let opacity = 1
    let dragging = false
    let currentPlay: ReturnType<typeof play> | ReturnType<typeof playValues> | null = null

    const applyTransform = (): void => {
      card.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`
      card.style.opacity = String(opacity)
    }

    const panHandle = gesture.pan(card, {
      onStart: () => {
        dragging = true
        currentPlay?.cancel()
        card.style.cursor = "grabbing"
        // trigger shine
        shine.style.transition = "none"
        shine.style.transform = "translateX(-100%)"
        void shine.offsetWidth
        shine.style.transition = "transform 0.8s ease-out"
        shine.style.transform = "translateX(100%)"
      },
      onMove: (ev) => {
        x = ev.offset.x
        y = ev.offset.y
        rot = ev.offset.x / 24
        applyTransform()
      },
      onEnd: (ev) => {
        dragging = false
        card.style.cursor = "grab"
        const speed = Math.hypot(ev.velocity.x, ev.velocity.y)
        const far = Math.hypot(ev.offset.x, ev.offset.y) > 160
        if (speed > 800 || far) {
          // Fling in velocity direction, then respawn
          const mag = Math.max(speed, 900)
          const nx = ev.velocity.x / (speed || 1)
          const ny = ev.velocity.y / (speed || 1)
          const targetX = x + nx * mag * 0.9
          const targetY = y + ny * mag * 0.9
          const targetRot = rot + nx * 40
          const fromX = x
          const fromY = y
          const fromRot = rot
          currentPlay = playValues(
            tween(
              {
                tx: [fromX, targetX],
                ty: [fromY, targetY],
                tr: [fromRot, targetRot],
                op: [1, 0],
              },
              { duration: 700 },
            ),
            (v) => {
              x = v.tx
              y = v.ty
              rot = v.tr
              opacity = v.op
              applyTransform()
            },
            {
              onFinish: () => {
                x = 0
                y = 0
                rot = 0
                opacity = 0
                applyTransform()
                currentPlay = playValues(
                  spring({ op: [0, 1], sc: [0.6, 1] }, { stiffness: 180, damping: 18 }),
                  (v) => {
                    opacity = v.op
                    card.style.transform = `translate(0,0) scale(${v.sc})`
                    card.style.opacity = String(opacity)
                  },
                )
              },
            },
          )
        } else {
          // Spring home
          const fromX = x
          const fromY = y
          const fromRot = rot
          currentPlay = playValues(
            spring(
              { tx: [fromX, 0], ty: [fromY, 0], tr: [fromRot, 0] },
              { stiffness: 180, damping: 14 },
            ),
            (v) => {
              x = v.tx
              y = v.ty
              rot = v.tr
              applyTransform()
            },
          )
        }
      },
    })

    void dragging

    return () => {
      panHandle.cancel()
      currentPlay?.cancel()
    }
  },
}
