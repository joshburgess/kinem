import { easeOut, play, tween } from "@kinem/core"
import type { Example } from "../example"

const COUNT = 15

export const staggerCenter: Example = {
  id: "stagger-center",
  title: "Stagger from center",
  description: "Order radiates outward. Uses from: 'center' semantics via delay offsets.",
  mount(stage) {
    stage.style.display = "flex"
    stage.style.alignItems = "center"
    stage.style.justifyContent = "center"
    stage.style.gap = "6px"

    const dots: HTMLElement[] = []
    for (let i = 0; i < COUNT; i++) {
      const d = document.createElement("div")
      d.className = "dot"
      d.style.position = "static"
      d.style.width = "16px"
      d.style.height = "16px"
      stage.appendChild(d)
      dots.push(d)
    }

    const controls: ReturnType<typeof play>[] = []
    const delayFor = (i: number): number => {
      const mid = (COUNT - 1) / 2
      return Math.abs(i - mid) * 60
    }

    const run = (): void => {
      controls.forEach((c) => c.cancel())
      controls.length = 0
      dots.forEach((dot) => {
        dot.style.transform = "scale(0)"
      })
      dots.forEach((dot, i) => {
        setTimeout(() => {
          controls.push(
            play(tween({ scale: [0, 1] }, { duration: 300, easing: easeOut }), dot),
          )
        }, delayFor(i))
      })
    }

    run()
    const interval = setInterval(run, 2000)
    return () => {
      clearInterval(interval)
      controls.forEach((c) => c.cancel())
    }
  },
}
