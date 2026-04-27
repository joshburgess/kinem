import { type AnimationDef, easeInOut, tween } from "@kinem/core"
import type { Demo } from "../demo"

const SVG_NS = "http://www.w3.org/2000/svg"
const W = 360
const H = 540
const N_BLOBS = 3

// Cone profile: top of glass is narrow, bottom is wide. Insets are in
// pixels from the edges of the W x H box. Top width = W - 2 * TOP_INSET.
const TOP_INSET = 90
const BOT_INSET = 16

// Full hue rotation period (ms). Long enough that the shift reads as a
// mood change, not a flicker.
const HUE_PERIOD = 38_000

// One radial control point on a blob's silhouette. The blob is drawn
// as a closed Bezier through NUM_PETALS such points; each petal's radius
// oscillates independently, so the silhouette breathes and morphs
// asymmetrically without ever splitting into separate shapes.
interface Petal {
  baseScale: number
  rAmp: number
  rDur: number
  rPhase: number
}

interface Blob {
  el: SVGPathElement
  petals: Petal[]
  scratch: number[]
  rise: AnimationDef<number>
  sway: AnimationDef<number>
  baseR: number
  baseX: number
  riseDur: number
  swayDur: number
  riseOffset: number
  swayOffset: number
  baseRotation: number
  spinRate: number
}

const NUM_PETALS = 8

// Closed cubic-Bezier path through `radii` evenly spaced around (cx, cy).
// Tangents at each point are estimated from the chord between its two
// neighbors (Catmull-Rom-to-Bezier with tension 1/6), giving a smooth
// continuous closed curve that follows the radii without kinks.
const buildBlobPath = (
  cx: number,
  cy: number,
  radii: number[],
  rotation: number,
): string => {
  const n = radii.length
  const xs = new Array<number>(n)
  const ys = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rotation
    xs[i] = cx + Math.cos(a) * radii[i]!
    ys[i] = cy + Math.sin(a) * radii[i]!
  }
  const tension = 1 / 6
  let d = `M ${xs[0]!.toFixed(2)} ${ys[0]!.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n
    const i2 = (i + 1) % n
    const i3 = (i + 2) % n
    const x0 = xs[i0]!
    const y0 = ys[i0]!
    const x1 = xs[i]!
    const y1 = ys[i]!
    const x2 = xs[i2]!
    const y2 = ys[i2]!
    const x3 = xs[i3]!
    const y3 = ys[i3]!
    const c1x = x1 + (x2 - x0) * tension
    const c1y = y1 + (y2 - y0) * tension
    const c2x = x2 - (x3 - x1) * tension
    const c2y = y2 - (y3 - y1) * tension
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }
  return `${d} Z`
}

export const lavaLamp: Demo = {
  id: "lava-lamp",
  title: "Lava lamp · gooey blob orchestra",
  blurb:
    "Six blobs each composed from independent rise, sway, and pulse defs. An SVG goo filter (blur + threshold matrix) blends them into a continuous wax flow when they touch. A slow hue rotation drifts the whole palette through the spectrum so the lamp never reads the same way twice.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background:
        "radial-gradient(ellipse at 50% 70%, #1a1430 0%, #0a0818 50%, #04030a 100%)",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const lamp = document.createElement("div")
    Object.assign(lamp.style, {
      position: "relative",
      width: `${W + 80}px`,
      height: `${H + 220}px`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      filter: "drop-shadow(0 24px 80px rgba(140, 100, 220, 0.25))",
    })
    wrap.appendChild(lamp)

    // Solid black cap with a rounded top, sized to hug the cone's
    // narrow top with only a small lip on each side.
    const capW = W - 2 * TOP_INSET + 24
    const cap = document.createElement("div")
    Object.assign(cap.style, {
      width: `${capW}px`,
      height: "52px",
      borderRadius: "12px 12px 3px 3px",
      background: "linear-gradient(180deg, #2c2c30 0%, #0a0a0c 35%, #030305 100%)",
      boxShadow:
        "inset 0 2px 0 rgba(255, 255, 255, 0.18), inset 0 -3px 8px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)",
      marginBottom: "-10px",
      zIndex: "3",
    })
    lamp.appendChild(cap)

    // Glass body: a trapezoid clip-path produces the classic conical
    // silhouette. The hue-rotate filter on glassWrap drifts the entire
    // interior palette together, preserving the complementary relationship
    // between liquid and wax color.
    const conePolygon =
      `polygon(${TOP_INSET}px 0, ${W - TOP_INSET}px 0, ` +
      `${W - BOT_INSET}px 100%, ${BOT_INSET}px 100%)`

    const glassWrap = document.createElement("div")
    Object.assign(glassWrap.style, {
      position: "relative",
      width: `${W}px`,
      height: `${H}px`,
      clipPath: conePolygon,
      // Translucent internally lit liquid: alpha < 1 lets the lamp's
      // outer scene tint through, reading as real glass instead of paint.
      background:
        "radial-gradient(ellipse at 50% 105%, rgba(192, 139, 255, 0.78) 0%, rgba(144, 97, 245, 0.72) 30%, rgba(111, 51, 214, 0.66) 65%, rgba(63, 21, 146, 0.6) 100%)",
    })
    lamp.appendChild(glassWrap)

    // Ambient warm wash from the bulb at the bottom and the cap at the
    // top, layered behind the wax to suggest internal illumination.
    const innerGlow = document.createElement("div")
    Object.assign(innerGlow.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 100%, rgba(255, 220, 180, 0.28) 0%, transparent 45%), " +
        "radial-gradient(ellipse at 35% 25%, rgba(220, 180, 255, 0.20) 0%, transparent 65%)",
      pointerEvents: "none",
      zIndex: "2",
    })
    glassWrap.appendChild(innerGlow)

    // Two-tier base drawn as an SVG path with smooth Bezier curves: a
    // bulb section that's wider at the top (so the glass sits *on* the
    // base instead of overhanging it), pinching to a waist, then flaring
    // out to a wider plinth at the bottom. The top edge (360px) is wider
    // than the cone's bottom (328px) so the glass meets the base cleanly.
    const baseGradId = `lava-base-grad-${Math.random().toString(36).slice(2, 8)}`
    const base = document.createElementNS(SVG_NS, "svg")
    base.setAttribute("viewBox", "0 0 480 160")
    base.setAttribute("width", "480")
    base.setAttribute("height", "160")
    Object.assign(base.style, {
      marginTop: "-12px",
      filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.55))",
      overflow: "visible",
      zIndex: "3",
    })
    base.innerHTML = `
      <defs>
        <radialGradient id="${baseGradId}" cx="50%" cy="0%" r="85%">
          <stop offset="0%" stop-color="#2a2a32" />
          <stop offset="35%" stop-color="#0e0e14" />
          <stop offset="75%" stop-color="#030305" />
          <stop offset="100%" stop-color="#000" />
        </radialGradient>
      </defs>
      <path d="
        M 64 0
        L 416 0
        C 414 22 404 48 388 66
        C 410 92 446 128 472 156
        Q 474 160 470 160
        L 10 160
        Q 6 160 8 156
        C 34 128 70 92 92 66
        C 76 48 66 22 64 0 Z
      " fill="url(#${baseGradId})" />
    `
    lamp.appendChild(base)

    // Heat glow at the bottom of the glass; sits behind the blobs to give
    // the impression of a heating element warming the wax.
    const heat = document.createElement("div")
    Object.assign(heat.style, {
      position: "absolute",
      left: "50%",
      bottom: "0",
      transform: "translateX(-50%)",
      width: "85%",
      height: "130px",
      background:
        "radial-gradient(ellipse at 50% 100%, rgba(255, 220, 180, 0.55) 0%, rgba(255, 180, 100, 0.25) 35%, transparent 70%)",
      filter: "blur(8px)",
      pointerEvents: "none",
      zIndex: "0",
    })
    glassWrap.appendChild(heat)

    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice")
    Object.assign(svg.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "1",
    })
    glassWrap.appendChild(svg)

    const filterId = `lava-goo-${Math.random().toString(36).slice(2, 8)}`
    const gradientId = `lava-grad-${Math.random().toString(36).slice(2, 8)}`
    svg.innerHTML = `
      <defs>
        <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
          <feColorMatrix values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 26 -12" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        <radialGradient id="${gradientId}" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#ffe9c2" />
          <stop offset="28%" stop-color="#ffb060" />
          <stop offset="60%" stop-color="#ff5a28" />
          <stop offset="88%" stop-color="#c81818" />
          <stop offset="100%" stop-color="#7a0e0e" />
        </radialGradient>
      </defs>
    `

    const group = document.createElementNS(SVG_NS, "g")
    group.setAttribute("filter", `url(#${filterId})`)
    svg.appendChild(group)

    // Highlight overlay: a curved gloss strip on the left of the glass.
    // White-based so the hue-rotate filter leaves it mostly neutral.
    const gloss = document.createElement("div")
    Object.assign(gloss.style, {
      position: "absolute",
      left: "20%",
      top: "8%",
      width: "10%",
      height: "75%",
      background:
        "linear-gradient(115deg, rgba(255, 255, 255, 0.30) 0%, rgba(255, 255, 255, 0.06) 60%, transparent 100%)",
      borderRadius: "50%",
      filter: "blur(3px)",
      pointerEvents: "none",
      zIndex: "2",
    })
    glassWrap.appendChild(gloss)

    // Bottom puddle: a wide, shallow pool of wax that sits on the
    // heating element. Anchored low enough that only its top arc shows
    // inside the glass, like the references.
    const puddle = document.createElementNS(SVG_NS, "ellipse")
    puddle.setAttribute("cx", String(W / 2))
    puddle.setAttribute("cy", String(H + 30))
    puddle.setAttribute("rx", "170")
    puddle.setAttribute("ry", "90")
    puddle.setAttribute("fill", `url(#${gradientId})`)
    group.appendChild(puddle)

    // Top slick: a small chunk of cooled wax in the narrow neck.
    const slick = document.createElementNS(SVG_NS, "ellipse")
    slick.setAttribute("cx", String(W / 2))
    slick.setAttribute("cy", String(-40))
    slick.setAttribute("rx", "70")
    slick.setAttribute("ry", "40")
    slick.setAttribute("fill", `url(#${gradientId})`)
    group.appendChild(slick)

    // Vertical travel range: avoid the puddle and slick so blobs visibly
    // separate from and rejoin the masses.
    const TOP_Y = 130
    const BOT_Y = H - 90

    // Cone radius at a given y. Used to keep blob sway inside the glass.
    const halfWidthAt = (y: number): number => {
      const t = y / H
      const inset = TOP_INSET + (BOT_INSET - TOP_INSET) * t
      return W / 2 - inset
    }

    const blobs: Blob[] = []

    const rand = (() => {
      let s = 0x9e3779b9
      return (): number => {
        s = (s * 1664525 + 1013904223) | 0
        return ((s >>> 0) % 10_000) / 10_000
      }
    })()

    for (let i = 0; i < N_BLOBS; i++) {
      // Each blob is one large continuous shape with 8 petals whose
      // radii each oscillate over a different period. The asymmetric
      // baseScale gives a non-circular resting silhouette; rAmp animates
      // it. With 8 petals all morphing on different periods, the blob
      // appears to bulge and pinch organically.
      const baseR = 48 + rand() * 22
      const safeHalf = Math.max(20, halfWidthAt(TOP_Y) - baseR * 1.4 - 8)
      const baseX = W / 2 + (rand() * 2 - 1) * safeHalf * 0.45
      const swayAmp = 4 + rand() * 8

      const riseDur = 22_000 + rand() * 14_000
      const swayDur = 10_000 + rand() * 7_000

      const petals: Petal[] = []
      for (let j = 0; j < NUM_PETALS; j++) {
        petals.push({
          baseScale: 0.78 + rand() * 0.4,
          rAmp: 0.1 + rand() * 0.18,
          rDur: 4500 + rand() * 5500,
          rPhase: rand() * 9000,
        })
      }

      const path = document.createElementNS(SVG_NS, "path")
      path.setAttribute("fill", `url(#${gradientId})`)
      group.appendChild(path)

      const rise = tween({ y: [BOT_Y, TOP_Y] }, { duration: riseDur, easing: easeInOut })
      const sway = tween({ x: [-swayAmp, swayAmp] }, { duration: swayDur, easing: easeInOut })

      blobs.push({
        el: path,
        petals,
        scratch: new Array<number>(NUM_PETALS).fill(0),
        rise: { duration: rise.duration, interpolate: (p) => rise.interpolate(p).y },
        sway: { duration: sway.duration, interpolate: (p) => sway.interpolate(p).x },
        baseR,
        baseX,
        riseDur,
        swayDur,
        riseOffset: rand() * riseDur,
        swayOffset: rand() * swayDur,
        baseRotation: rand() * Math.PI * 2,
        // Very slow drift rotation, ~ ±1.7°/sec, so the asymmetric
        // silhouette doesn't look stuck in one orientation.
        spinRate: (rand() * 2 - 1) * 0.03,
      })
    }

    // Triangle-wave yoyo with easeInOut on top so motion slows at both
    // ends of each pass.
    const yoyo = (t: number, period: number): number => {
      const u = ((t % period) + period) % period
      const half = period / 2
      return u < half ? u / half : 1 - (u - half) / half
    }

    let rafId = 0
    const start = performance.now()
    const tick = (): void => {
      const t = performance.now() - start

      // Drift the entire glass interior (liquid bg, wax, glow) through
      // the spectrum together. White-based highlights stay neutral.
      const hue = ((t / HUE_PERIOD) % 1) * 360
      glassWrap.style.filter = `hue-rotate(${hue}deg)`

      for (const b of blobs) {
        const py = yoyo(t + b.riseOffset, b.riseDur)
        const px = yoyo(t + b.swayOffset, b.swayDur)

        const cy = b.rise.interpolate(py)
        const margin = halfWidthAt(cy) - b.baseR * 1.4 - 2
        const swayClamp = Math.max(0, Math.min(1, margin / 40))
        const cx = b.baseX + b.sway.interpolate(px) * swayClamp
        const rotation = b.baseRotation + (t / 1000) * b.spinRate

        for (let j = 0; j < b.petals.length; j++) {
          const p = b.petals[j]!
          const u = yoyo(t + p.rPhase, p.rDur)
          const e = easeInOut(u)
          b.scratch[j] = b.baseR * (p.baseScale + (e * 2 - 1) * p.rAmp)
        }

        b.el.setAttribute("d", buildBlobPath(cx, cy, b.scratch, rotation))
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  },
}
