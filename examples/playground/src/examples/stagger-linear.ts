import { easeOut, play, tween } from "motif-animate"
import type { Example } from "../example"

const COUNT = 12

export const staggerLinear: Example = {
  id: "stagger-linear",
  title: "Stagger (linear)",
  description: "Dots appear from left to right with a 40ms step.",
  mount(stage) {
    stage.style.display = "flex"
    stage.style.alignItems = "center"
    stage.style.justifyContent = "center"
    stage.style.gap = "8px"
    stage.style.padding = "16px"

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
    const run = (): void => {
      controls.forEach((c) => c.cancel())
      controls.length = 0
      dots.forEach((dot, i) => {
        setTimeout(() => {
          controls.push(
            play(
              tween({ opacity: [0, 1], y: [-12, 0] }, { duration: 400, easing: easeOut }),
              dot,
            ),
          )
        }, i * 40)
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
