import { playViewTransition } from "@kinem/core"
import type { Example } from "../example"

const VIEWS = [
  {
    title: "Tokyo",
    body: "Neon billboards, crosswalk shuffles, and ramen broth in the air.",
    bg: "linear-gradient(135deg, #ff7c9c, #ce7cff)",
  },
  {
    title: "Reykjavík",
    body: "Black sand, midnight sun, and basalt cliffs that hum with wind.",
    bg: "linear-gradient(135deg, #7c9cff, #7cffce)",
  },
  {
    title: "Marrakesh",
    body: "Spice piles, tiled courtyards, and twilight calls to prayer.",
    bg: "linear-gradient(135deg, #ffce7c, #ff7c9c)",
  },
] as const

const SUPPORTS_VT =
  typeof document !== "undefined" &&
  typeof (document as Document & { startViewTransition?: unknown }).startViewTransition ===
    "function"

export const viewTransition: Example = {
  id: "view-transition",
  title: "View Transitions API",
  description: SUPPORTS_VT
    ? "playViewTransition() wraps document.startViewTransition. Click to swap cards."
    : "playViewTransition() falls back to a sync mutation when the API is unavailable.",
  tall: true,
  mount(stage) {
    stage.style.position = "relative"
    stage.style.padding = "12px"
    stage.style.display = "flex"
    stage.style.flexDirection = "column"
    stage.style.gap = "10px"

    const card = document.createElement("div")
    card.style.flex = "1"
    card.style.borderRadius = "12px"
    card.style.padding = "16px"
    card.style.color = "#0f1117"
    card.style.font = "600 14px system-ui"
    card.style.display = "flex"
    card.style.flexDirection = "column"
    card.style.justifyContent = "space-between"
    ;(card.style as CSSStyleDeclaration & { viewTransitionName?: string }).viewTransitionName =
      "vt-card"
    stage.appendChild(card)

    const controls = document.createElement("div")
    controls.style.display = "flex"
    controls.style.gap = "6px"
    controls.style.alignItems = "center"
    controls.style.justifyContent = "space-between"
    stage.appendChild(controls)

    const button = document.createElement("button")
    button.type = "button"
    button.textContent = "Next"
    button.style.padding = "6px 12px"
    button.style.borderRadius = "6px"
    button.style.border = "1px solid #2a2f3c"
    button.style.background = "#1a1d27"
    button.style.color = "#cbd2e0"
    button.style.cursor = "pointer"
    button.style.font = "500 12px system-ui"
    controls.appendChild(button)

    const support = document.createElement("span")
    support.style.font = "11px monospace"
    support.style.color = SUPPORTS_VT ? "#8892a6" : "#f0a070"
    support.textContent = SUPPORTS_VT ? "view transitions: supported" : "view transitions: fallback"
    controls.appendChild(support)

    let index = 0
    const renderView = (i: number): void => {
      const v = VIEWS[i]
      if (!v) return
      card.style.background = v.bg
      const title = document.createElement("h3")
      title.style.margin = "0"
      title.style.font = "700 18px system-ui"
      title.textContent = v.title
      const body = document.createElement("p")
      body.style.margin = "0"
      body.style.font = "400 13px/1.4 system-ui"
      body.textContent = v.body
      card.replaceChildren(title, body)
    }

    renderView(index)

    let pending: ReturnType<typeof playViewTransition> | null = null
    const onClick = (): void => {
      if (pending && pending.state === "playing") return
      pending = playViewTransition(() => {
        index = (index + 1) % VIEWS.length
        renderView(index)
      })
    }
    button.addEventListener("click", onClick)

    return () => {
      button.removeEventListener("click", onClick)
      if (pending && pending.state === "playing") pending.cancel()
    }
  },
}
