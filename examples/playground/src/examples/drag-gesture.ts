import { gesture } from "motif-animate"
import type { Example } from "../example"

export const dragGesture: Example = {
  id: "drag-gesture",
  title: "Drag gesture",
  description: "Drag the square. Releases fly free, bounded to the stage.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.left = "50%"
    box.style.top = "50%"
    box.style.transform = "translate(-50%, -50%)"
    box.style.cursor = "grab"
    stage.appendChild(box)

    const handle = gesture.drag(box, {
      bounds: {
        left: -stage.clientWidth / 2 + 30,
        right: stage.clientWidth / 2 - 30,
        top: -stage.clientHeight / 2 + 30,
        bottom: stage.clientHeight / 2 - 30,
      },
    })

    return () => handle.cancel()
  },
}
