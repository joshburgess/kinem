import { play, spring } from "motif-animate"
import type { Example } from "../example"

export const springDrop: Example = {
  id: "spring-drop",
  title: "Spring physics",
  description: "Click to drop. Damping controls the wobble.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.left = "50%"
    box.style.top = "20px"
    box.style.transform = "translate(-50%, 0)"
    box.style.cursor = "pointer"
    stage.appendChild(box)

    const hint = document.createElement("div")
    hint.textContent = "click"
    hint.style.position = "absolute"
    hint.style.bottom = "8px"
    hint.style.right = "12px"
    hint.style.font = "11px monospace"
    hint.style.color = "#8892a6"
    stage.appendChild(hint)

    const drop = (): void => {
      const h = stage.clientHeight - 60
      play(
        spring({ y: [0, h] }, { stiffness: 280, damping: 12, mass: 1 }),
        box,
      )
    }
    const reset = (): void => {
      play(spring({ y: [stage.clientHeight - 60, 0] }, { stiffness: 200, damping: 20 }), box)
    }

    let dropped = false
    const onClick = (): void => {
      dropped = !dropped
      if (dropped) drop()
      else reset()
    }
    stage.addEventListener("click", onClick)
    return () => stage.removeEventListener("click", onClick)
  },
}
