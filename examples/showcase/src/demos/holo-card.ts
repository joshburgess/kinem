import { playCanvas, spring } from "@kinem/core"
import type { Demo } from "../demo"

const TILT_MAX = 18

export const holoCard: Demo = {
  id: "holo-card",
  title: "Holographic tilt card",
  blurb:
    "Pokémon-foil card. Move the pointer over it and the rainbow shifts with viewing angle. Spring physics return it to neutral when you leave.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 30%, #1a0f2e 0%, #07080b 70%)",
      perspective: "1400px",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const card = document.createElement("div")
    Object.assign(card.style, {
      position: "relative",
      width: "320px",
      height: "440px",
      borderRadius: "22px",
      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #92400e 100%)",
      boxShadow:
        "0 30px 80px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.2)",
      transformStyle: "preserve-3d",
      willChange: "transform",
      overflow: "hidden",
      userSelect: "none",
      touchAction: "none",
    })
    wrap.appendChild(card)

    // Foil layer: rainbow stripes that slide as the card tilts
    const foil = document.createElement("div")
    Object.assign(foil.style, {
      position: "absolute",
      inset: "0",
      borderRadius: "22px",
      backgroundImage: `repeating-linear-gradient(
        110deg,
        rgba(255, 0, 170, 0.85) 0%,
        rgba(0, 255, 240, 0.85) 8%,
        rgba(255, 240, 0, 0.85) 16%,
        rgba(80, 0, 255, 0.85) 24%,
        rgba(255, 0, 170, 0.85) 32%
      )`,
      backgroundSize: "300% 300%",
      backgroundPosition: "50% 50%",
      mixBlendMode: "color-dodge",
      opacity: "0.35",
      pointerEvents: "none",
      willChange: "background-position, opacity",
    })
    card.appendChild(foil)

    // Diagonal pinstripe noise
    const stripes = document.createElement("div")
    Object.assign(stripes.style, {
      position: "absolute",
      inset: "0",
      borderRadius: "22px",
      backgroundImage: `repeating-linear-gradient(
        65deg,
        rgba(255,255,255,0) 0px,
        rgba(255,255,255,0) 6px,
        rgba(255,255,255,0.18) 7px,
        rgba(255,255,255,0) 10px
      )`,
      mixBlendMode: "overlay",
      pointerEvents: "none",
    })
    card.appendChild(stripes)

    // Sparkle dots
    const sparkle = document.createElement("div")
    Object.assign(sparkle.style, {
      position: "absolute",
      inset: "0",
      borderRadius: "22px",
      backgroundImage: `
        radial-gradient(2px 2px at 14% 18%, rgba(255,255,255,0.95), transparent 60%),
        radial-gradient(1.5px 1.5px at 38% 65%, rgba(255,255,255,0.75), transparent 60%),
        radial-gradient(1.5px 1.5px at 72% 32%, rgba(255,255,255,0.9), transparent 60%),
        radial-gradient(2px 2px at 84% 78%, rgba(255,255,255,0.8), transparent 60%),
        radial-gradient(1.5px 1.5px at 22% 82%, rgba(255,255,255,0.75), transparent 60%),
        radial-gradient(1.5px 1.5px at 58% 8%, rgba(255,255,255,0.9), transparent 60%),
        radial-gradient(1px 1px at 46% 48%, rgba(255,255,255,0.6), transparent 60%)
      `,
      mixBlendMode: "screen",
      pointerEvents: "none",
    })
    card.appendChild(sparkle)

    // Specular highlight that tracks the cursor
    const glare = document.createElement("div")
    Object.assign(glare.style, {
      position: "absolute",
      inset: "0",
      borderRadius: "22px",
      background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55) 0%, transparent 35%)",
      mixBlendMode: "soft-light",
      opacity: "0",
      pointerEvents: "none",
      willChange: "background, opacity",
    })
    card.appendChild(glare)

    // Card content
    const content = document.createElement("div")
    Object.assign(content.style, {
      position: "absolute",
      inset: "16px",
      borderRadius: "14px",
      background: "rgba(0,0,0,0.18)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "22px",
      color: "white",
      pointerEvents: "none",
    })
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800;font-size:13px;letter-spacing:0.32em;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,0.5)">Kinem</div>
        <div style="font-weight:700;font-size:11px;letter-spacing:0.18em;opacity:0.85">★ HOLO</div>
      </div>
      <div style="text-align:center;font-size:120px;line-height:1;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.5))">🦄</div>
      <div>
        <div style="font-weight:800;font-size:24px;letter-spacing:-0.02em;text-shadow:0 2px 8px rgba(0,0,0,0.5)">Spring Unicorn</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;font-weight:500">Composed motion · physics · WebGL</div>
      </div>
    `
    card.appendChild(content)

    let tx = 0
    let ty = 0
    let activePlay: ReturnType<typeof playCanvas> | null = null

    const apply = (px: number, py: number): void => {
      // px, py in [0, 100] for the radial center; tx, ty in degrees
      card.style.transform = `rotateY(${tx}deg) rotateX(${-ty}deg)`
      const intensity = Math.min(1, Math.hypot(tx, ty) / TILT_MAX)
      foil.style.backgroundPosition = `${px * 1.8}% ${py * 1.8}%`
      foil.style.opacity = String(0.25 + intensity * 0.55)
      glare.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.65) 0%, transparent 38%)`
      glare.style.opacity = String(0.35 + intensity * 0.55)
    }

    const onMove = (e: PointerEvent): void => {
      activePlay?.cancel()
      const r = card.getBoundingClientRect()
      const u = (e.clientX - r.left) / r.width
      const v = (e.clientY - r.top) / r.height
      tx = (u - 0.5) * 2 * TILT_MAX
      ty = (v - 0.5) * 2 * TILT_MAX
      apply(u * 100, v * 100)
    }

    const onLeave = (): void => {
      activePlay?.cancel()
      const fromX = tx
      const fromY = ty
      const fromIntensity = Math.min(1, Math.hypot(fromX, fromY) / TILT_MAX)
      activePlay = playCanvas(
        spring(
          { x: [fromX, 0], y: [fromY, 0], k: [fromIntensity, 0] },
          { stiffness: 130, damping: 14 },
        ),
        (val) => {
          tx = val.x
          ty = val.y
          card.style.transform = `rotateY(${tx}deg) rotateX(${-ty}deg)`
          foil.style.opacity = String(0.25 + val.k * 0.55)
          glare.style.opacity = String(0.35 + val.k * 0.55)
        },
      )
    }

    card.addEventListener("pointermove", onMove)
    card.addEventListener("pointerleave", onLeave)

    apply(50, 50)

    return () => {
      card.removeEventListener("pointermove", onMove)
      card.removeEventListener("pointerleave", onLeave)
      activePlay?.cancel()
    }
  },
}
