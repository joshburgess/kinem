import { keyframes, playStagger } from "@kinem/core"
import type { Demo } from "../demo"

const ITEM_COUNT = 7
const RADIUS = 130
const ITEM_SIZE = 52

const ICONS = ["★", "✦", "◆", "♥", "✿", "❄", "☀"]
const HUES = [340, 290, 220, 180, 140, 95, 45]

export const liquidMenu: Demo = {
  id: "liquid-menu",
  title: "Liquid menu · radial stagger spring",
  blurb:
    "Click the center button. Seven items radiate outward via `playStagger`, each running a `keyframes` scale/opacity wave with overshoot. Click again to reverse the cascade and tuck them back in.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 50%, #1a1230 0%, #07080b 70%), radial-gradient(ellipse at 80% 20%, #2c1d4a 0%, transparent 60%)",
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const hint = document.createElement("div")
    hint.textContent = "click the center"
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

    const center = document.createElement("div")
    Object.assign(center.style, {
      position: "relative",
      width: "0",
      height: "0",
    })
    wrap.appendChild(center)

    const items: HTMLDivElement[] = []
    for (let i = 0; i < ITEM_COUNT; i++) {
      const angle = -Math.PI / 2 + (i / ITEM_COUNT) * Math.PI * 2
      const tx = Math.cos(angle) * RADIUS
      const ty = Math.sin(angle) * RADIUS
      const hue = HUES[i] ?? 220
      const item = document.createElement("div")
      Object.assign(item.style, {
        position: "absolute",
        left: `${tx - ITEM_SIZE / 2}px`,
        top: `${ty - ITEM_SIZE / 2}px`,
        width: `${ITEM_SIZE}px`,
        height: `${ITEM_SIZE}px`,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, hsl(${hue}, 90%, 75%), hsl(${hue}, 80%, 50%))`,
        boxShadow: `0 0 24px hsla(${hue}, 90%, 65%, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)`,
        display: "grid",
        placeItems: "center",
        color: "rgba(255,255,255,0.95)",
        font: "700 22px/1 ui-sans-serif, system-ui, sans-serif",
        cursor: "pointer",
        userSelect: "none",
        opacity: "0",
        transform: "scale(0)",
        willChange: "transform, opacity",
      })
      item.textContent = ICONS[i] ?? "•"
      center.appendChild(item)
      items.push(item)
    }

    const button = document.createElement("button")
    Object.assign(button.style, {
      position: "absolute",
      left: "-32px",
      top: "-32px",
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      border: "none",
      background:
        "radial-gradient(circle at 35% 30%, #fff 0%, #f472b6 35%, #a78bfa 75%, #7c9cff 100%)",
      boxShadow:
        "0 0 32px rgba(167,139,250,0.6), inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px rgba(0,0,0,0.4)",
      cursor: "pointer",
      color: "rgba(255,255,255,0.95)",
      font: "700 28px/1 ui-sans-serif, system-ui, sans-serif",
      transition: "transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      willChange: "transform",
    })
    button.textContent = "+"
    center.appendChild(button)

    let open = false
    let activeRun: ReturnType<typeof playStagger> | null = null

    const order = (i: number): number => Math.abs(i - (ITEM_COUNT - 1) / 2)

    const toggle = (): void => {
      activeRun?.cancel()
      open = !open
      button.style.transform = open ? "rotate(45deg)" : "rotate(0deg)"

      const def = open
        ? keyframes({ scale: [0, 1.18, 1], opacity: [0, 1, 1] }, { duration: 520 })
        : keyframes({ scale: [1, 0.7, 0], opacity: [1, 1, 0] }, { duration: 380 })

      activeRun = playStagger(def, items as never, {
        each: open ? 38 : 28,
        from: order,
      })
    }

    button.addEventListener("click", toggle)

    const auto = window.setTimeout(toggle, 420)

    return () => {
      window.clearTimeout(auto)
      button.removeEventListener("click", toggle)
      activeRun?.cancel()
    }
  },
}
