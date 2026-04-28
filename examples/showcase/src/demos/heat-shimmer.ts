import { jitter, playValues } from "@kinem/core"
import type { AnimationDef } from "@kinem/core"
import type { Demo } from "../demo"

const TEXT = "MIRAGE"
const CYCLE_MS = 9000

interface ShimmerVal {
  x: number
  y: number
  r: number
}

export const heatShimmer: Demo = {
  id: "heat-shimmer",
  title: "Heat shimmer · jitter wobble",
  blurb:
    "Each character runs an independent `jitter` channel layered on a stable identity def. Feeding wrapping progress at a constant rate produces continuous deterministic noise — heat haze without per-frame randomness.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 75%, #f59e0b 0%, #c2410c 22%, #1c1108 70%), linear-gradient(180deg, #2a1d0e 0%, #0a0604 100%)",
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const sun = document.createElement("div")
    Object.assign(sun.style, {
      position: "absolute",
      width: "360px",
      height: "360px",
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(254,243,199,0.95) 0%, rgba(245,158,11,0.6) 30%, transparent 70%)",
      bottom: "12%",
      filter: "blur(28px)",
      opacity: "0.85",
      pointerEvents: "none",
    })
    wrap.appendChild(sun)

    const horizon = document.createElement("div")
    Object.assign(horizon.style, {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "30%",
      height: "1px",
      background:
        "linear-gradient(90deg, transparent 0%, rgba(254,215,170,0.65) 50%, transparent 100%)",
      filter: "blur(0.5px)",
      pointerEvents: "none",
    })
    wrap.appendChild(horizon)

    const title = document.createElement("div")
    Object.assign(title.style, {
      position: "relative",
      display: "flex",
      gap: "10px",
      filter: "drop-shadow(0 6px 28px rgba(254, 215, 170, 0.55))",
      marginBottom: "8%",
    })
    wrap.appendChild(title)

    interface Char {
      el: HTMLDivElement
      def: AnimationDef<ShimmerVal>
    }

    const chars: Char[] = []
    const baseDef: AnimationDef<ShimmerVal> = {
      duration: 1000,
      interpolate: () => ({ x: 0, y: 0, r: 0 }),
    }

    for (let i = 0; i < TEXT.length; i++) {
      const span = document.createElement("div")
      span.textContent = TEXT[i] ?? ""
      Object.assign(span.style, {
        font: "900 132px/1 Georgia, 'Times New Roman', serif",
        color: "#fff7ed",
        letterSpacing: "0.04em",
        willChange: "transform",
        textShadow: "0 0 26px rgba(254, 215, 170, 0.65), 0 0 4px rgba(255,255,255,0.4)",
      })
      title.appendChild(span)

      const def = jitter<ShimmerVal>(baseDef, {
        amplitude: 12,
        frequency: 7,
        seed: i * 17 + 3,
      })
      chars.push({ el: span, def })
    }

    // The shimmer is one repeating sweep through phase 0->1; each char
    // samples its own jitter channel at the shared phase. Driving via
    // playValues with repeat:true gives the loop devtools visibility and
    // a real Controls handle for cleanup.
    const handle = playValues(
      { duration: CYCLE_MS, interpolate: (p) => p },
      (p) => {
        for (const c of chars) {
          const v = c.def.interpolate(p)
          c.el.style.transform = `translate(${(v.x * 0.6).toFixed(2)}px, ${(v.y * 1.6).toFixed(2)}px) rotate(${(v.r * 0.25).toFixed(3)}deg) skewX(${(v.x * 0.18).toFixed(3)}deg)`
        }
      },
      { repeat: true },
    )

    return () => handle.cancel()
  },
}
