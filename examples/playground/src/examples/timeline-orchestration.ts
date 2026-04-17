import { easeInOut, easeOut, timeline, tween } from "motif-animate"
import type { Example } from "../example"

export const timelineOrchestration: Example = {
  id: "timeline-orchestration",
  title: "Timeline",
  description: "Box slides in, rotates, then fades alongside a second box. Uses labels.",
  wide: false,
  mount(stage) {
    const box1 = document.createElement("div")
    box1.className = "box"
    box1.style.top = "50%"
    box1.style.left = "20px"
    box1.style.transform = "translateY(-50%)"
    box1.style.opacity = "0"
    stage.appendChild(box1)

    const box2 = document.createElement("div")
    box2.className = "box"
    box2.style.top = "50%"
    box2.style.right = "20px"
    box2.style.transform = "translateY(-50%)"
    box2.style.opacity = "0"
    box2.style.background = "#f59e0b"
    stage.appendChild(box2)

    const run = (): ReturnType<ReturnType<typeof timeline>["play"]> => {
      const tl = timeline()
      tl.add(tween({ opacity: [0, 1], x: [-40, 0] }, { duration: 500, easing: easeOut }), box1)
      tl.add(tween({ rotate: ["0deg", "360deg"] }, { duration: 700, easing: easeInOut }), box1, {
        at: ">",
        label: "rotated",
      })
      tl.add(tween({ opacity: [0, 1], x: [40, 0] }, { duration: 500, easing: easeOut }), box2, {
        at: "rotated",
        offset: -300,
      })
      return tl.play()
    }

    let ctrl = run()
    const interval = setInterval(() => {
      ctrl.cancel()
      box1.style.opacity = "0"
      box1.style.transform = "translateY(-50%)"
      box2.style.opacity = "0"
      box2.style.transform = "translateY(-50%)"
      ctrl = run()
    }, 2600)

    return () => {
      clearInterval(interval)
      ctrl.cancel()
    }
  },
}
