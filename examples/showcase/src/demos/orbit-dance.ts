import { arc, scrub } from "@kinem/core"
import type { Demo } from "../demo"

interface RingDef {
  readonly radius: number
  readonly count: number
  readonly speed: number
  readonly direction: 1 | -1
  readonly hue: number
  readonly size: number
}

const RINGS: readonly RingDef[] = [
  { radius: 90, count: 5, speed: 1.6, direction: 1, hue: 200, size: 14 },
  { radius: 165, count: 8, speed: 1.0, direction: -1, hue: 280, size: 11 },
  { radius: 240, count: 12, speed: 0.65, direction: 1, hue: 340, size: 9 },
]

export const orbitDance: Demo = {
  id: "orbit-dance",
  title: "Orbit dance · arc + scrub",
  blurb:
    "Three rings of satellites orbit a sun on exact circles via the `arc` primitive. Sweep the cursor horizontally to scrub the orbital phase; each ring is driven by its own `scrub` handle.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 50%, #1a103a 0%, #07080b 70%), radial-gradient(ellipse at 80% 20%, #1d2347 0%, transparent 60%)",
      cursor: "ew-resize",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    // Star field.
    const starField = document.createElement("div")
    Object.assign(starField.style, { position: "absolute", inset: "0", pointerEvents: "none" })
    wrap.appendChild(starField)
    for (let i = 0; i < 110; i++) {
      const s = document.createElement("div")
      const size = 1 + Math.random() * 2
      Object.assign(s.style, {
        position: "absolute",
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "rgba(232,236,244,0.55)",
        opacity: String(0.3 + Math.random() * 0.7),
      })
      starField.appendChild(s)
    }

    const center = document.createElement("div")
    Object.assign(center.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "0",
      height: "0",
      pointerEvents: "none",
    })
    wrap.appendChild(center)

    const sun = document.createElement("div")
    const sunSize = 64
    Object.assign(sun.style, {
      position: "absolute",
      left: `${-sunSize / 2}px`,
      top: `${-sunSize / 2}px`,
      width: `${sunSize}px`,
      height: `${sunSize}px`,
      borderRadius: "50%",
      background:
        "radial-gradient(circle at 35% 30%, #fff 0%, #fde68a 30%, #f59e0b 75%, transparent 100%)",
      boxShadow: "0 0 60px rgba(251,191,36,0.65), 0 0 130px rgba(251,113,133,0.35)",
      pointerEvents: "none",
      animation: "kinem-sun-pulse 4s ease-in-out infinite",
    })
    center.appendChild(sun)

    // Inject a tiny sun pulse keyframe on demand.
    if (!document.querySelector("style#kinem-orbit-style")) {
      const styleEl = document.createElement("style")
      styleEl.id = "kinem-orbit-style"
      styleEl.textContent = `
        @keyframes kinem-sun-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
      `
      document.head.appendChild(styleEl)
    }

    // Faint orbit guide rings.
    for (const ring of RINGS) {
      const g = document.createElement("div")
      Object.assign(g.style, {
        position: "absolute",
        left: `${-ring.radius}px`,
        top: `${-ring.radius}px`,
        width: `${ring.radius * 2}px`,
        height: `${ring.radius * 2}px`,
        borderRadius: "50%",
        border: `1px dashed hsla(${ring.hue}, 80%, 65%, 0.18)`,
        pointerEvents: "none",
      })
      center.appendChild(g)
    }

    interface Sat {
      el: HTMLDivElement
      offset: number
    }

    const ringSats: Sat[][] = RINGS.map((ring) => {
      const arr: Sat[] = []
      for (let i = 0; i < ring.count; i++) {
        const el = document.createElement("div")
        Object.assign(el.style, {
          position: "absolute",
          left: `${-ring.size}px`,
          top: `${-ring.size}px`,
          width: `${ring.size * 2}px`,
          height: `${ring.size * 2}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, hsl(${ring.hue}, 95%, 80%), hsl(${ring.hue}, 85%, 50%))`,
          boxShadow: `0 0 ${ring.size * 1.6}px hsla(${ring.hue}, 95%, 65%, 0.85)`,
          pointerEvents: "none",
          willChange: "transform",
        })
        center.appendChild(el)
        arr.push({ el, offset: i / ring.count })
      }
      return arr
    })

    // One arc def per ring (full circle, signed for direction). Duration
    // is symbolic — we drive progress directly via scrub.setProgress().
    const ringDefs = RINGS.map((ring) => arc(0, 0, ring.radius, 0, 360 * ring.direction))

    // One scrub per ring. The onProgress callback positions every sat
    // in that ring at its current phase offset.
    const ringScrubs = RINGS.map((ring, ri) => {
      return scrub(ringDefs[ri] as never, [], {
        onProgress: (p) => {
          const def = ringDefs[ri]
          const sats = ringSats[ri]
          if (!def || !sats) return
          for (const sat of sats) {
            let q = p + sat.offset
            q = ((q % 1) + 1) % 1
            const v = def.interpolate(q)
            sat.el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0)`
          }
        },
      })
    })

    // Per-ring progress accumulator.
    const ringProgress: number[] = RINGS.map(() => 0)
    let scrubBias = 0
    let lastMx = -1
    let inside = false

    const onMove = (e: PointerEvent): void => {
      const rect = wrap.getBoundingClientRect()
      const mx = e.clientX - rect.left
      if (lastMx >= 0) {
        scrubBias += (mx - lastMx) / 600
      }
      lastMx = mx
      inside = true
    }
    const onLeave = (): void => {
      inside = false
      lastMx = -1
    }
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerleave", onLeave)

    let rafId = 0
    let last = performance.now()
    const tick = (): void => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      for (let r = 0; r < RINGS.length; r++) {
        const ring = RINGS[r] as RingDef
        // Auto orbit + cursor-driven bias.
        let p = (ringProgress[r] ?? 0) + (ring.speed * dt) / 8
        if (inside) p += scrubBias * ring.speed
        p = ((p % 1) + 1) % 1
        ringProgress[r] = p
        ringScrubs[r]?.setProgress(p)
      }
      // Decay the cursor bias so movement stops feel naturally damped.
      scrubBias *= 0.9
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerleave", onLeave)
      for (const s of ringScrubs) s.cancel()
    }
  },
}
