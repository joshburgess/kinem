import { easeOut, play, splitText, tween } from "@kinem/core"
import type { Example } from "../example"

export const textReveal: Example = {
  id: "text-reveal",
  title: "Text splitText()",
  description: "Chars animate in with a staggered rise. Revert restores the original markup.",
  mount(stage) {
    stage.style.display = "flex"
    stage.style.alignItems = "center"
    stage.style.justifyContent = "center"
    stage.style.padding = "24px"

    const h = document.createElement("div")
    h.style.font = "600 28px/1.2 ui-sans-serif, system-ui, sans-serif"
    h.style.letterSpacing = "-0.02em"
    h.style.textAlign = "center"
    h.textContent = "Animate every letter."
    stage.appendChild(h)

    const controls: ReturnType<typeof play>[] = []
    let split = splitText(h, { by: ["words", "chars"] })

    const run = (): void => {
      controls.forEach((c) => c.cancel())
      controls.length = 0
      split.revert()
      split = splitText(h, { by: ["words", "chars"] })
      split.chars.forEach((c, i) => {
        c.style.opacity = "0"
        setTimeout(() => {
          controls.push(
            play(tween({ opacity: [0, 1], y: [12, 0] }, { duration: 400, easing: easeOut }), c),
          )
        }, i * 30)
      })
    }

    run()
    const interval = setInterval(run, 2400)
    return () => {
      clearInterval(interval)
      controls.forEach((c) => c.cancel())
      split.revert()
    }
  },
}
