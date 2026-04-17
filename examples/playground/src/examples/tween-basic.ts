import { easeOut, play, tween } from "motif-animate"
import type { Example } from "../example"

export const tweenBasic: Example = {
  id: "tween-basic",
  title: "Basic tween",
  description: "Opacity + translateY from 0 to 1, running on a loop.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.left = "50%"
    box.style.top = "50%"
    box.style.transform = "translate(-50%, -50%)"
    stage.appendChild(box)

    let controls = play(
      tween({ opacity: [0, 1], y: [20, 0] }, { duration: 800, easing: easeOut }),
      box,
    )
    const interval = setInterval(() => {
      controls.cancel()
      controls = play(
        tween({ opacity: [0, 1], y: [20, 0] }, { duration: 800, easing: easeOut }),
        box,
      )
    }, 1400)

    return () => {
      clearInterval(interval)
      controls.cancel()
    }
  },
}
