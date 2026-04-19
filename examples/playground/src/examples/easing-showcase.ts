import { cubicBezier, easeInOut, easeOut, linear, play, tween, type EasingFn } from "kinem"
import type { Example } from "../example"

const rows: { label: string; easing: EasingFn }[] = [
  { label: "linear", easing: linear },
  { label: "easeOut", easing: easeOut },
  { label: "easeInOut", easing: easeInOut },
  { label: "cubic-bezier(.17,.67,.83,.67)", easing: cubicBezier(0.17, 0.67, 0.83, 0.67) },
]

export const easingShowcase: Example = {
  id: "easing-showcase",
  title: "Easing comparison",
  description: "Four boxes racing: linear vs easeOut vs easeInOut vs custom bezier.",
  tall: true,
  mount(stage) {
    stage.style.padding = "16px"
    const wrap = document.createElement("div")
    wrap.style.position = "relative"
    wrap.style.height = "100%"
    stage.appendChild(wrap)

    const boxes: HTMLElement[] = []
    rows.forEach((row, i) => {
      const track = document.createElement("div")
      track.style.position = "absolute"
      track.style.top = `${i * 48 + 8}px`
      track.style.left = "0"
      track.style.right = "0"
      track.style.height = "32px"

      const label = document.createElement("div")
      label.textContent = row.label
      label.style.position = "absolute"
      label.style.left = "8px"
      label.style.top = "-14px"
      label.style.font = "12px monospace"
      label.style.color = "#8892a6"
      track.appendChild(label)

      const box = document.createElement("div")
      box.className = "dot"
      box.style.top = "50%"
      box.style.left = "0"
      box.style.transform = "translateY(-50%)"
      box.style.width = "14px"
      box.style.height = "14px"
      track.appendChild(box)
      boxes.push(box)

      wrap.appendChild(track)
    })

    const run = (): (() => void) => {
      const controlsList = rows.map((row, i) =>
        play(
          tween({ x: [0, stage.clientWidth - 32] }, { duration: 1600, easing: row.easing }),
          boxes[i]!,
        ),
      )
      return () => controlsList.forEach((c) => c.cancel())
    }

    let dispose = run()
    const interval = setInterval(() => {
      dispose()
      boxes.forEach((b) => (b.style.transform = "translate(0, -50%)"))
      dispose = run()
    }, 1900)

    return () => {
      clearInterval(interval)
      dispose()
    }
  },
}
