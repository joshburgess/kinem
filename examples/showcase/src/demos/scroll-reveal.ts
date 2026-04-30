import { inView, motionValue, trackNamed } from "@kinem/core"
import type { Demo } from "../demo"

interface CardData {
  readonly title: string
  readonly body: string
  readonly hue: number
}

const CARDS: readonly CardData[] = [
  {
    title: "00 / observer",
    body: "Each card calls inView() once on mount. The observer fires enter when the card crosses the threshold, and leave when it scrolls back out.",
    hue: 215,
  },
  {
    title: "01 / symmetry",
    body: "Enter slides the card up and fades it in. The leave callback (returned from enter) reverses the transform, so scroll direction matters.",
    hue: 200,
  },
  {
    title: "02 / return",
    body: "Scroll back up. Cards that re-enter trigger a fresh enter, since once: false is the default. Try it.",
    hue: 175,
  },
  {
    title: "03 / threshold",
    body: "rootMargin lets you fire the callback early or late. This demo uses '0px 0px -25%' so reveals start before the card hits the fold.",
    hue: 145,
  },
  {
    title: "04 / composition",
    body: "inView is the bridge from layout to motion. Wire its callbacks to play(), tween(), or any reactive cell. The primitive itself is just an observer.",
    hue: 110,
  },
  {
    title: "05 / once",
    body: "Pass { once: true } when you want a one-shot reveal. We don't use it here so you can scroll back and forth to see both halves of the lifecycle.",
    hue: 75,
  },
  {
    title: "06 / entry data",
    body: "The InViewEntry mirrors the IntersectionObserverEntry: target, isIntersecting, intersectionRatio, boundingClientRect, time. Use it for stagger by index or for layout-aware reveals.",
    hue: 40,
  },
  {
    title: "07 / cleanup",
    body: "The stop function unobserves and runs the pending leave. The demo wires it into the cleanup tuple so navigating away tears down every observer.",
    hue: 15,
  },
  {
    title: "08 / fin",
    body: "End of the column. Scroll back up to see the cards re-enter from the top.",
    hue: 285,
  },
]

export const scrollReveal: Demo = {
  id: "scroll-reveal",
  title: "Scroll reveal with inView()",
  blurb:
    "Scroll the column. Each card calls inView() to react when it crosses the viewport: enter slides it up and fades it in; the returned leave callback reverses the transform on exit. A live counter on the right tracks how many cards are currently visible by listening to a single motionValue derived from the observer callbacks.",
  group: "Reactive values",
  mount(stage) {
    const offTrack = trackNamed("scroll-reveal")

    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 30%, #0c1220 0%, #050810 60%, #02030a 100%)",
    })
    stage.appendChild(wrap)

    const viewport = document.createElement("div")
    Object.assign(viewport.style, {
      position: "absolute",
      inset: "0",
      overflow: "auto",
      scrollbarWidth: "thin",
      paddingTop: "32px",
      paddingBottom: "120px",
    })
    wrap.appendChild(viewport)

    const column = document.createElement("div")
    Object.assign(column.style, {
      maxWidth: "560px",
      margin: "0 auto",
      padding: "20vh 24px",
      display: "flex",
      flexDirection: "column",
      gap: "180px",
    })
    viewport.appendChild(column)

    // Reactive readout: how many cards are currently in view.
    const visibleCount = motionValue(0)

    const stops: Array<() => void> = []

    for (let i = 0; i < CARDS.length; i++) {
      const data = CARDS[i]!
      const card = document.createElement("article")
      Object.assign(card.style, {
        position: "relative",
        padding: "28px 30px 30px",
        borderRadius: "18px",
        background: `linear-gradient(180deg, hsla(${data.hue}, 60%, 12%, 0.85), hsla(${data.hue}, 50%, 7%, 0.92))`,
        border: `1px solid hsla(${data.hue}, 60%, 60%, 0.22)`,
        boxShadow: `0 18px 60px hsla(${data.hue}, 70%, 30%, 0.18)`,
        color: "#dde6f7",
        font: "14px/1.6 ui-sans-serif, system-ui",
        // Pre-enter state. inView's enter callback overrides these.
        opacity: "0",
        transform: "translateY(40px)",
        transition:
          "opacity 520ms cubic-bezier(.22,.65,.3,1), transform 620ms cubic-bezier(.22,.65,.3,1)",
        willChange: "opacity, transform",
      })

      const tag = document.createElement("div")
      tag.textContent = data.title
      Object.assign(tag.style, {
        font: "600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: `hsl(${data.hue} 75% 75%)`,
        marginBottom: "10px",
      })
      card.appendChild(tag)

      const body = document.createElement("div")
      body.textContent = data.body
      card.appendChild(body)

      column.appendChild(card)

      const stop = inView(
        card,
        () => {
          card.style.opacity = "1"
          card.style.transform = "translateY(0)"
          visibleCount.set(visibleCount.get() + 1)
          // Returned leave fires when the card scrolls back out. inView
          // delivers the InViewEntry argument here, but we ignore it:
          // the card already knows its own state.
          return () => {
            card.style.opacity = "0"
            card.style.transform = "translateY(40px)"
            visibleCount.set(Math.max(0, visibleCount.get() - 1))
          }
        },
        {
          root: viewport,
          rootMargin: "0px 0px -25% 0px",
          amount: 0.2,
        },
      )
      stops.push(stop)
    }

    // Hint pinned to the top-right of the viewport.
    const hint = document.createElement("div")
    Object.assign(hint.style, {
      position: "absolute",
      top: "16px",
      right: "20px",
      padding: "6px 12px",
      borderRadius: "999px",
      background: "rgba(8, 12, 28, 0.55)",
      border: "1px solid rgba(160, 180, 255, 0.18)",
      color: "#cdd9ff",
      font: "12px ui-sans-serif, system-ui",
      pointerEvents: "none",
      backdropFilter: "blur(6px)",
    })
    hint.textContent = "Scroll the column up and down"
    wrap.appendChild(hint)

    // Live readout pinned to the bottom-left.
    const readout = document.createElement("div")
    Object.assign(readout.style, {
      position: "absolute",
      left: "16px",
      bottom: "16px",
      padding: "10px 14px",
      borderRadius: "10px",
      background: "rgba(8, 12, 28, 0.55)",
      border: "1px solid rgba(160, 180, 255, 0.18)",
      color: "#cdd9ff",
      font: "12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
      backdropFilter: "blur(6px)",
      pointerEvents: "none",
      minWidth: "180px",
    })
    readout.innerHTML = `
      <div style="opacity: 0.6; margin-bottom: 4px">reactive sources</div>
      <div>cards in view&nbsp;<span data-k="n">0</span> / ${CARDS.length}</div>
      <div>observers&nbsp;&nbsp;&nbsp;&nbsp;${CARDS.length}</div>
    `
    wrap.appendChild(readout)
    const nCell = readout.querySelector('[data-k="n"]') as HTMLElement
    const offN = visibleCount.on((value) => {
      nCell.textContent = String(value)
    })

    return () => {
      for (const stop of stops) stop()
      offN()
      visibleCount.destroy()
      offTrack()
    }
  },
}
