import { easeOut, gesture, tween } from "kinem"
import type { Example } from "../example"

export const hoverGesture: Example = {
  id: "hover-gesture",
  title: "Hover gesture",
  description: "Hover the square. Enter scales up; leave reverses back.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.left = "50%"
    box.style.top = "50%"
    box.style.transform = "translate(-50%, -50%)"
    box.style.cursor = "pointer"
    stage.appendChild(box)

    const handle = gesture.hover(box, {
      enter: tween(
        { scale: [1, 1.6], backgroundColor: ["#7c9cff", "#f59e0b"] },
        { duration: 250, easing: easeOut },
      ),
    })

    return () => handle.cancel()
  },
}
