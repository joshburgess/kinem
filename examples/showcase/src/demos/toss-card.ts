import { createVelocityTracker, inertia, spring } from "@kinem/core"
import type { Demo } from "../demo"

const RESET_DELAY = 600
const FLING_THRESHOLD = 600 // px/s

export const tossCard: Demo = {
  id: "toss-card",
  title: "Toss to dismiss · inertia release",
  blurb:
    "Drag the card and let go. A gentle release springs back; a hard fling decays away with momentum (`inertia`) and respawns. Try varying the throw speed.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 50%, #1a1230 0%, #07080b 70%), radial-gradient(ellipse at 80% 20%, #2c1d4a 0%, transparent 60%)",
      overflow: "hidden",
      display: "grid",
      placeItems: "center",
    })
    stage.appendChild(wrap)

    const hint = document.createElement("div")
    hint.textContent = "drag · throw fast to dismiss"
    Object.assign(hint.style, {
      position: "absolute",
      bottom: "32px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(232,236,244,0.55)",
      fontSize: "12px",
      letterSpacing: "0.32em",
      textTransform: "uppercase",
      pointerEvents: "none",
      fontWeight: "600",
    })
    wrap.appendChild(hint)

    const speedReadout = document.createElement("div")
    Object.assign(speedReadout.style, {
      position: "absolute",
      top: "24px",
      right: "32px",
      color: "rgba(232,236,244,0.7)",
      font: "500 12px ui-monospace, SF Mono, Menlo, monospace",
      letterSpacing: "0.08em",
      pointerEvents: "none",
    })
    wrap.appendChild(speedReadout)

    const card = document.createElement("div")
    Object.assign(card.style, {
      position: "relative",
      width: "260px",
      height: "340px",
      borderRadius: "22px",
      background:
        "linear-gradient(135deg, #f472b6 0%, #a78bfa 45%, #7c9cff 100%), radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.6), transparent 50%)",
      boxShadow:
        "0 24px 70px rgba(167,139,250,0.45), 0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.45)",
      cursor: "grab",
      touchAction: "none",
      userSelect: "none",
      willChange: "transform",
      display: "grid",
      placeItems: "center",
      color: "rgba(255,255,255,0.92)",
      font: "700 22px/1.2 ui-sans-serif, system-ui, sans-serif",
      letterSpacing: "0.03em",
      textAlign: "center",
      padding: "24px",
      whiteSpace: "pre-line",
    })
    card.textContent = "Toss me\noff-screen"
    wrap.appendChild(card)

    let x = 0
    let y = 0
    let dragging = false
    let pointerId = -1
    let downX = 0
    let downY = 0
    let releaseRaf = 0
    let resetTimer = 0

    const tracker = createVelocityTracker({ windowMs: 80 })

    const apply = (): void => {
      const tilt = Math.max(-18, Math.min(18, x / 22))
      card.style.transform = `translate(${x}px, ${y}px) rotate(${tilt}deg)`
    }

    const fmtSpeed = (vx: number, vy: number): string => {
      const speed = Math.hypot(vx, vy)
      return `vel  ${speed.toFixed(0).padStart(4, " ")} px/s`
    }

    const cancelRelease = (): void => {
      cancelAnimationFrame(releaseRaf)
      releaseRaf = 0
    }

    const driveDef = <T extends { x: number; y: number }>(
      def: { duration: number; interpolate: (p: number) => T },
      onDone: () => void,
    ): void => {
      const start = performance.now()
      const step = (): void => {
        const elapsed = performance.now() - start
        const p = def.duration === 0 ? 1 : Math.min(1, elapsed / def.duration)
        const v = def.interpolate(p)
        x = v.x
        y = v.y
        apply()
        if (p < 1) {
          releaseRaf = requestAnimationFrame(step)
        } else {
          releaseRaf = 0
          onDone()
        }
      }
      releaseRaf = requestAnimationFrame(step)
    }

    const respawn = (): void => {
      card.style.transition = "opacity 240ms ease"
      card.style.opacity = "0"
      window.setTimeout(() => {
        x = 0
        y = 0
        apply()
        card.style.transition = ""
        card.style.opacity = "1"
        speedReadout.textContent = ""
      }, 220)
    }

    const onDown = (e: PointerEvent): void => {
      cancelRelease()
      window.clearTimeout(resetTimer)
      dragging = true
      pointerId = e.pointerId
      downX = e.clientX - x
      downY = e.clientY - y
      card.style.cursor = "grabbing"
      card.setPointerCapture(pointerId)
      tracker.reset()
      tracker.record({ x: e.clientX, y: e.clientY, time: performance.now() })
    }

    const onMove = (e: PointerEvent): void => {
      if (!dragging) return
      x = e.clientX - downX
      y = e.clientY - downY
      tracker.record({ x: e.clientX, y: e.clientY, time: performance.now() })
      const v = tracker.velocity()
      speedReadout.textContent = fmtSpeed(v.x * 1000, v.y * 1000)
      apply()
    }

    const onUp = (): void => {
      if (!dragging) return
      dragging = false
      card.style.cursor = "grab"
      try {
        card.releasePointerCapture(pointerId)
      } catch {
        // Pointer may already be released; ignore.
      }
      const v = tracker.velocity()
      const vxPerSec = v.x * 1000
      const vyPerSec = v.y * 1000
      const speed = Math.hypot(vxPerSec, vyPerSec)
      speedReadout.textContent = fmtSpeed(vxPerSec, vyPerSec)

      if (speed > FLING_THRESHOLD) {
        const def = inertia(
          { x: [x, vxPerSec], y: [y, vyPerSec] },
          { timeConstant: 380, power: 0.95, restDelta: 1 },
        )
        driveDef(def, () => {
          resetTimer = window.setTimeout(respawn, RESET_DELAY)
        })
      } else {
        const def = spring({ x: [x, 0], y: [y, 0] }, { stiffness: 260, damping: 22 })
        driveDef(def, () => {
          speedReadout.textContent = ""
        })
      }
    }

    card.addEventListener("pointerdown", onDown)
    card.addEventListener("pointermove", onMove)
    card.addEventListener("pointerup", onUp)
    card.addEventListener("pointercancel", onUp)

    apply()

    card.style.opacity = "0"
    requestAnimationFrame(() => {
      card.style.transition = "opacity 320ms ease"
      card.style.opacity = "1"
    })
    const settleTimer = window.setTimeout(() => {
      card.style.transition = ""
    }, 360)

    return () => {
      card.removeEventListener("pointerdown", onDown)
      card.removeEventListener("pointermove", onMove)
      card.removeEventListener("pointerup", onUp)
      card.removeEventListener("pointercancel", onUp)
      cancelRelease()
      window.clearTimeout(resetTimer)
      window.clearTimeout(settleTimer)
    }
  },
}
