import { scroll, tween } from "motif-animate"
import type { Example } from "../example"

export const scrollSynced: Example = {
  id: "scroll-synced",
  title: "Scroll-synced",
  description: "Scroll the page. This bar's width tracks this card's position through the viewport.",
  mount(stage) {
    const bar = document.createElement("div")
    bar.style.position = "absolute"
    bar.style.top = "50%"
    bar.style.left = "8px"
    bar.style.right = "8px"
    bar.style.transform = "translateY(-50%)"
    bar.style.height = "12px"
    bar.style.borderRadius = "6px"
    bar.style.background = "linear-gradient(90deg, #7c9cff 0%, #7c9cff var(--p, 0%), #141821 var(--p, 0%))"
    stage.appendChild(bar)

    const hint = document.createElement("div")
    hint.textContent = "scroll page"
    hint.style.position = "absolute"
    hint.style.top = "8px"
    hint.style.right = "12px"
    hint.style.font = "11px monospace"
    hint.style.color = "#8892a6"
    stage.appendChild(hint)

    const handle = scroll(
      tween({ opacity: [0, 1] }, { duration: 1 }),
      stage,
      {
        sync: true,
        trigger: { start: "top 100%", end: "bottom 0%" },
        onProgress: (p) => {
          bar.style.setProperty("--p", `${Math.round(p * 100)}%`)
        },
      },
    )

    return () => handle.cancel()
  },
}
