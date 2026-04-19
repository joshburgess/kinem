import { easeOut, play, sequence, tween } from "@kinem/core"
import type { Example } from "../example"

export const sequenceComposition: Example = {
  id: "sequence-composition",
  title: "sequence(...)",
  description: "Right → down → left. Each tween plays after the previous finishes.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.left = "20px"
    box.style.top = "20px"
    stage.appendChild(box)

    const w = () => stage.clientWidth - 60
    const h = () => stage.clientHeight - 60

    const run = (): ReturnType<typeof play> => {
      const right = tween({ x: [0, w()] }, { duration: 500, easing: easeOut })
      const down = tween({ x: [w(), w()], y: [0, h()] }, { duration: 500, easing: easeOut })
      const back = tween({ x: [w(), 0], y: [h(), h()] }, { duration: 500, easing: easeOut })
      return play(sequence(right, down, back), box)
    }

    let ctrl = run()
    const interval = setInterval(() => {
      ctrl.cancel()
      box.style.transform = "translate(0, 0)"
      ctrl = run()
    }, 1800)

    return () => {
      clearInterval(interval)
      ctrl.cancel()
    }
  },
}
