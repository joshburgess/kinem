import { playCanvas, spring } from "@kinem/core"
import type { Demo } from "../demo"

const LINKS = ["Home", "Work", "Stories", "Lab", "Contact"]

export const magneticNav: Demo = {
  id: "magnetic-nav",
  title: "Magnetic nav with morph pill",
  blurb:
    "Links attract your cursor. A gradient pill morphs between the active item with spring physics on position and size.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 50%, #0f1220 0%, #07080b 70%)",
    })
    stage.appendChild(wrap)

    const frame = document.createElement("div")
    Object.assign(frame.style, {
      position: "relative",
      padding: "12px 18px",
      borderRadius: "20px",
      background: "rgba(20, 24, 38, 0.6)",
      backdropFilter: "blur(20px)",
      boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)",
      display: "flex",
      gap: "8px",
      alignItems: "center",
    })
    wrap.appendChild(frame)

    const pill = document.createElement("div")
    Object.assign(pill.style, {
      position: "absolute",
      top: "12px",
      left: "0",
      height: "40px",
      width: "80px",
      borderRadius: "12px",
      background: "linear-gradient(135deg, #7c9cff 0%, #f472b6 100%)",
      boxShadow: "0 8px 24px rgba(124,156,255,0.4)",
      pointerEvents: "none",
      willChange: "transform, width",
      opacity: "0",
      transition: "opacity 200ms",
    })
    frame.appendChild(pill)

    const items: HTMLElement[] = []
    const activeGestures: { cancel(): void }[] = []
    const activePlays: { cancel(): void }[] = []

    const state = new Map<HTMLElement, { dx: number; dy: number }>()

    LINKS.forEach((label, i) => {
      const a = document.createElement("a")
      a.textContent = label
      a.href = "#"
      Object.assign(a.style, {
        position: "relative",
        zIndex: "2",
        padding: "0 18px",
        height: "40px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "12px",
        color: "rgba(232,236,244,0.75)",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: "600",
        letterSpacing: "0.01em",
        willChange: "transform",
        transition: "color 200ms",
      })
      a.addEventListener("click", (e) => {
        e.preventDefault()
        setActive(i)
      })
      frame.appendChild(a)
      items.push(a)
      state.set(a, { dx: 0, dy: 0 })
    })

    const setActive = (i: number): void => {
      const el = items[i]
      if (!el) return
      items.forEach((it) => {
        it.style.color = it === el ? "white" : "rgba(232,236,244,0.75)"
      })
      const frameRect = frame.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const targetLeft = r.left - frameRect.left
      const targetWidth = r.width
      pill.style.opacity = "1"

      // Read current pill transform
      const current = pill.style.transform || "translateX(0px)"
      const m = /translateX\(([-\d.]+)px\)/.exec(current)
      const fromLeft = m ? Number.parseFloat(m[1] ?? "0") : 0
      const fromWidth = Number.parseFloat(pill.style.width || "80")

      activePlays.forEach((p) => p.cancel())
      activePlays.length = 0
      const p = playCanvas(
        spring(
          { x: [fromLeft, targetLeft], w: [fromWidth, targetWidth] },
          { stiffness: 260, damping: 22 },
        ),
        (v) => {
          pill.style.transform = `translateX(${v.x}px)`
          pill.style.width = `${v.w}px`
        },
      )
      activePlays.push(p)
    }

    const applyItem = (el: HTMLElement): void => {
      const s = state.get(el)
      if (!s) return
      el.style.transform = `translate(${s.dx}px, ${s.dy}px)`
    }

    items.forEach((el) => {
      const attract = (e: PointerEvent): void => {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const radius = Math.max(r.width, r.height) * 1.6
        const dist = Math.hypot(dx, dy)
        if (dist > radius) {
          relax(el)
          return
        }
        const pull = (1 - dist / radius) * 0.35
        const s = state.get(el) ?? { dx: 0, dy: 0 }
        s.dx = dx * pull
        s.dy = dy * pull
        state.set(el, s)
        applyItem(el)
      }

      const relax = (target: HTMLElement): void => {
        const s = state.get(target)
        if (!s) return
        const fromDx = s.dx
        const fromDy = s.dy
        const p = playCanvas(
          spring({ dx: [fromDx, 0], dy: [fromDy, 0] }, { stiffness: 220, damping: 18 }),
          (v) => {
            s.dx = v.dx
            s.dy = v.dy
            applyItem(target)
          },
        )
        activePlays.push(p)
      }

      el.addEventListener("pointermove", attract)
      el.addEventListener("pointerleave", () => relax(el))
    })

    // Frame-level attract so you feel pull from further out
    const onFrameMove = (e: PointerEvent): void => {
      items.forEach((el) => {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const radius = Math.max(r.width, r.height) * 2
        const dist = Math.hypot(dx, dy)
        const s = state.get(el)
        if (!s) return
        if (dist > radius) return
        const pull = (1 - dist / radius) * 0.22
        s.dx = dx * pull
        s.dy = dy * pull
        applyItem(el)
      })
    }
    const onFrameLeave = (): void => {
      items.forEach((el) => {
        const s = state.get(el)
        if (!s) return
        const fromDx = s.dx
        const fromDy = s.dy
        const p = playCanvas(
          spring({ dx: [fromDx, 0], dy: [fromDy, 0] }, { stiffness: 220, damping: 18 }),
          (v) => {
            s.dx = v.dx
            s.dy = v.dy
            applyItem(el)
          },
        )
        activePlays.push(p)
      })
    }
    frame.addEventListener("pointermove", onFrameMove)
    frame.addEventListener("pointerleave", onFrameLeave)

    // Initial active
    requestAnimationFrame(() => setActive(0))

    return () => {
      activeGestures.forEach((g) => g.cancel())
      activePlays.forEach((p) => p.cancel())
      frame.removeEventListener("pointermove", onFrameMove)
      frame.removeEventListener("pointerleave", onFrameLeave)
    }
  },
}
