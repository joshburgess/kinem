import { easeOut, fromGrid, play, tween } from "kinem"
import type { Example } from "../example"

const ROWS = 5
const COLS = 8

export const staggerGrid: Example = {
  id: "stagger-grid",
  title: "Stagger from grid (fromGrid)",
  description: "5×8 grid, radiating from the center cell using a euclidean metric.",
  tall: true,
  mount(stage) {
    stage.style.display = "grid"
    stage.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`
    stage.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`
    stage.style.gap = "4px"
    stage.style.padding = "12px"

    const cells: HTMLElement[] = []
    for (let i = 0; i < ROWS * COLS; i++) {
      const c = document.createElement("div")
      c.style.background = "#7c9cff"
      c.style.borderRadius = "4px"
      cells.push(c)
      stage.appendChild(c)
    }

    const order = fromGrid({ rows: ROWS, cols: COLS, origin: "center" })
    const controls: ReturnType<typeof play>[] = []

    const run = (): void => {
      controls.forEach((c) => c.cancel())
      controls.length = 0
      cells.forEach((cell) => {
        cell.style.transform = "scale(0.2)"
        cell.style.opacity = "0.1"
      })
      cells.forEach((cell, i) => {
        const delay = order(i, cells.length) * 40
        setTimeout(() => {
          controls.push(
            play(
              tween({ scale: [0.2, 1], opacity: [0.1, 1] }, { duration: 360, easing: easeOut }),
              cell,
            ),
          )
        }, delay)
      })
    }

    run()
    const interval = setInterval(run, 2600)
    return () => {
      clearInterval(interval)
      controls.forEach((c) => c.cancel())
    }
  },
}
