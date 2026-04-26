import { gesture, playValues, spring, tween } from "@kinem/core"
import type { Demo } from "../demo"

interface CardDef {
  readonly title: string
  readonly subtitle: string
  readonly gradient: string
  readonly emoji: string
}

const CARDS: readonly CardDef[] = [
  {
    title: "Kyoto Temple",
    subtitle: "Golden hour · drone shot",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #7c3aed 100%)",
    emoji: "⛩",
  },
  {
    title: "Reykjavik Ice",
    subtitle: "Glacial lagoon · sunrise",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #1e1b4b 100%)",
    emoji: "🧊",
  },
  {
    title: "Marrakech Souk",
    subtitle: "Spice market · dusk",
    gradient: "linear-gradient(135deg, #f97316 0%, #dc2626 50%, #831843 100%)",
    emoji: "🕌",
  },
  {
    title: "Alpine Lake",
    subtitle: "Switzerland · summer",
    gradient: "linear-gradient(135deg, #34d399 0%, #06b6d4 50%, #0ea5e9 100%)",
    emoji: "🏔",
  },
  {
    title: "Sahara Night",
    subtitle: "Morocco · milky way",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #1e3a8a 50%, #020617 100%)",
    emoji: "🌌",
  },
]

export const cardStack: Demo = {
  id: "card-stack",
  title: "Physics card stack",
  blurb:
    "Drag-and-throw the top card. Velocity determines fling direction; the stack springs up to fill the gap.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      background: "radial-gradient(ellipse at 50% 30%, #0f1628 0%, #07080b 70%)",
      overflow: "hidden",
    })
    stage.appendChild(wrap)

    const deck = document.createElement("div")
    Object.assign(deck.style, {
      position: "relative",
      width: "300px",
      height: "420px",
    })
    wrap.appendChild(deck)

    const order: number[] = CARDS.map((_, i) => i)
    const cardEls: HTMLDivElement[] = []
    const activeGestures: { cancel(): void }[] = []
    const activePlays: { cancel(): void }[] = []

    const buildCard = (def: CardDef, depth: number): HTMLDivElement => {
      const el = document.createElement("div")
      Object.assign(el.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: "300px",
        height: "420px",
        borderRadius: "20px",
        background: def.gradient,
        boxShadow: "0 30px 80px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)",
        padding: "24px",
        color: "white",
        cursor: depth === 0 ? "grab" : "default",
        touchAction: "none",
        willChange: "transform",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      })
      el.innerHTML = `
        <div style="font-size:64px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3))">${def.emoji}</div>
        <div>
          <div style="font-size:24px; font-weight:700; letter-spacing:-0.02em; margin-bottom:4px">${def.title}</div>
          <div style="font-size:13px; opacity:0.85; font-weight:500">${def.subtitle}</div>
        </div>
      `
      return el
    }

    const positionForDepth = (depth: number): { scale: number; y: number; opacity: number } => {
      if (depth === 0) return { scale: 1, y: 0, opacity: 1 }
      if (depth === 1) return { scale: 0.94, y: 18, opacity: 0.85 }
      if (depth === 2) return { scale: 0.88, y: 34, opacity: 0.65 }
      return { scale: 0.82, y: 48, opacity: 0 }
    }

    const state = new Map<
      HTMLDivElement,
      { x: number; y: number; rot: number; scale: number; opacity: number }
    >()

    const apply = (el: HTMLDivElement): void => {
      const s = state.get(el)
      if (!s) return
      el.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg) scale(${s.scale})`
      el.style.opacity = String(s.opacity)
    }

    const layout = (animate: boolean): void => {
      order.forEach((idx, depth) => {
        const el = cardEls[idx]
        if (!el) return
        const target = positionForDepth(depth)
        const s = state.get(el) ?? { x: 0, y: 0, rot: 0, scale: 1, opacity: 1 }
        if (animate) {
          const from = { ...s }
          const play = playValues(
            spring(
              {
                x: [from.x, 0],
                y: [from.y, target.y],
                rot: [from.rot, 0],
                sc: [from.scale, target.scale],
                op: [from.opacity, target.opacity],
              },
              { stiffness: 180, damping: 20 },
            ),
            (v) => {
              s.x = v.x
              s.y = v.y
              s.rot = v.rot
              s.scale = v.sc
              s.opacity = v.op
              state.set(el, s)
              apply(el)
            },
          )
          activePlays.push(play)
        } else {
          s.x = 0
          s.y = target.y
          s.rot = 0
          s.scale = target.scale
          s.opacity = target.opacity
          state.set(el, s)
          apply(el)
        }
        el.style.zIndex = String(100 - depth)
        el.style.cursor = depth === 0 ? "grab" : "default"
        el.style.pointerEvents = depth === 0 ? "auto" : "none"
      })
    }

    const bindTopCard = (): void => {
      const topIdx = order[0]
      if (topIdx === undefined) return
      const el = cardEls[topIdx]
      if (!el) return

      const pan = gesture.pan(el, {
        onMove: (ev) => {
          const s = state.get(el)
          if (!s) return
          s.x = ev.offset.x
          s.y = ev.offset.y + positionForDepth(0).y
          s.rot = ev.offset.x / 20
          apply(el)
        },
        onEnd: (ev) => {
          const s = state.get(el)
          if (!s) return
          const speed = Math.hypot(ev.velocity.x, ev.velocity.y)
          const flung = speed > 600 || Math.abs(ev.offset.x) > 140
          if (flung) {
            const mag = Math.max(speed, 900)
            const nx = ev.velocity.x !== 0 ? ev.velocity.x / (speed || 1) : Math.sign(ev.offset.x)
            const ny = ev.velocity.y !== 0 ? ev.velocity.y / (speed || 1) : 0
            const targetX = s.x + nx * mag * 0.8
            const targetY = s.y + ny * mag * 0.8
            const targetRot = s.rot + nx * 30
            const fromX = s.x
            const fromY = s.y
            const fromRot = s.rot
            const p = playValues(
              tween(
                { x: [fromX, targetX], y: [fromY, targetY], r: [fromRot, targetRot], o: [1, 0] },
                { duration: 600 },
              ),
              (v) => {
                s.x = v.x
                s.y = v.y
                s.rot = v.r
                s.opacity = v.o
                apply(el)
              },
              {
                onFinish: () => {
                  // Move this card to the bottom of the stack
                  const moved = order.shift()
                  if (moved !== undefined) order.push(moved)
                  // Prepare the back card for re-entry
                  const depthIdx = order.indexOf(moved as number)
                  const back = positionForDepth(Math.max(depthIdx, 3))
                  s.x = 0
                  s.y = back.y + 40
                  s.rot = 0
                  s.scale = back.scale
                  s.opacity = 0
                  state.set(el, s)
                  apply(el)
                  rebindAll()
                },
              },
            )
            activePlays.push(p)
          } else {
            // Snap back to top slot
            const target = positionForDepth(0)
            const fromX = s.x
            const fromY = s.y
            const fromRot = s.rot
            const p = playValues(
              spring(
                { x: [fromX, 0], y: [fromY, target.y], r: [fromRot, 0] },
                { stiffness: 220, damping: 18 },
              ),
              (v) => {
                s.x = v.x
                s.y = v.y
                s.rot = v.r
                apply(el)
              },
            )
            activePlays.push(p)
          }
        },
      })
      activeGestures.push(pan)
    }

    const rebindAll = (): void => {
      activeGestures.forEach((g) => g.cancel())
      activeGestures.length = 0
      layout(true)
      bindTopCard()
    }

    CARDS.forEach((def, i) => {
      const el = buildCard(def, i)
      deck.appendChild(el)
      cardEls.push(el)
      state.set(el, { x: 0, y: 0, rot: 0, scale: 1, opacity: 1 })
    })

    layout(false)
    bindTopCard()

    return () => {
      activeGestures.forEach((g) => g.cancel())
      activePlays.forEach((p) => p.cancel())
    }
  },
}
