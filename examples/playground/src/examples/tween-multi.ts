import { easeInOut, play, tween } from "@kinem/core"
import type { Example } from "../example"

export const tweenMulti: Example = {
  id: "tween-multi",
  title: "Multi-property tween",
  description: "x, rotate, and backgroundColor animate together.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.top = "50%"
    box.style.left = "0"
    box.style.transform = "translateY(-50%)"
    stage.appendChild(box)

    const width = stage.clientWidth
    let forward = true
    let controls = play(
      tween(
        { x: [0, width - 40], rotate: ["0deg", "360deg"], backgroundColor: ["#7c9cff", "#f59e0b"] },
        { duration: 1500, easing: easeInOut },
      ),
      box,
    )
    const tick = (): void => {
      controls.cancel()
      forward = !forward
      controls = play(
        tween(
          forward
            ? {
                x: [0, width - 40],
                rotate: ["0deg", "360deg"],
                backgroundColor: ["#7c9cff", "#f59e0b"],
              }
            : {
                x: [width - 40, 0],
                rotate: ["360deg", "0deg"],
                backgroundColor: ["#f59e0b", "#7c9cff"],
              },
          { duration: 1500, easing: easeInOut },
        ),
        box,
      )
    }
    const interval = setInterval(tick, 1700)
    return () => {
      clearInterval(interval)
      controls.cancel()
    }
  },
}
