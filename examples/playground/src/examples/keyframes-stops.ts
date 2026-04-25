import { easeInOut, keyframes, play } from "@kinem/core"
import type { Example } from "../example"

export const keyframesStops: Example = {
  id: "keyframes-stops",
  title: "Keyframes",
  description: "Multi-stop animation: 0 → 100px → -20px → 0.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.top = "50%"
    box.style.left = "20px"
    box.style.transform = "translateY(-50%)"
    stage.appendChild(box)

    let ctrl = play(
      keyframes({ x: [0, stage.clientWidth - 140, -20, 0] }, { duration: 2000, easing: easeInOut }),
      box,
    )
    const interval = setInterval(() => {
      ctrl.cancel()
      ctrl = play(
        keyframes(
          { x: [0, stage.clientWidth - 140, -20, 0] },
          { duration: 2000, easing: easeInOut },
        ),
        box,
      )
    }, 2400)

    return () => {
      clearInterval(interval)
      ctrl.cancel()
    }
  },
}
