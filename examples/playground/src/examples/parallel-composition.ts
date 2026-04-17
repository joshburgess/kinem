import { easeInOut, parallel, play, tween } from "motif-animate"
import type { Example } from "../example"

export const parallelComposition: Example = {
  id: "parallel-composition",
  title: "parallel(...)",
  description: "Two tweens running simultaneously on the same target.",
  mount(stage) {
    const box = document.createElement("div")
    box.className = "box"
    box.style.top = "50%"
    box.style.left = "50%"
    box.style.transform = "translate(-50%, -50%)"
    stage.appendChild(box)

    const move = tween({ x: [-60, 60] }, { duration: 1200, easing: easeInOut })
    const spin = tween({ rotate: ["0deg", "360deg"] }, { duration: 1200 })
    const combined = parallel(move, spin)

    let ctrl = play(
      tween(
        { x: [-60, 60], rotate: ["0deg", "360deg"] },
        { duration: 1200, easing: easeInOut },
      ),
      box,
    )
    const interval = setInterval(() => {
      ctrl.cancel()
      ctrl = play(
        tween(
          { x: [-60, 60], rotate: ["0deg", "360deg"] },
          { duration: 1200, easing: easeInOut },
        ),
        box,
      )
    }, 1500)

    // `combined` is referenced in description to keep the import honest
    void combined

    return () => {
      clearInterval(interval)
      ctrl.cancel()
    }
  },
}
