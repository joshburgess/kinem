import { easeInOut, play, tween, wave } from "kinem"
import type { Example } from "../example"

const COUNT = 20

export const staggerWave: Example = {
  id: "stagger-wave",
  title: "Stagger (wave pattern)",
  description: "Order is linear but modulated by a sine wave, producing a ripple.",
  mount(stage) {
    stage.style.display = "flex"
    stage.style.alignItems = "center"
    stage.style.justifyContent = "center"
    stage.style.gap = "4px"

    const bars: HTMLElement[] = []
    for (let i = 0; i < COUNT; i++) {
      const b = document.createElement("div")
      b.style.width = "8px"
      b.style.height = "60px"
      b.style.borderRadius = "2px"
      b.style.background = "#7c9cff"
      bars.push(b)
      stage.appendChild(b)
    }

    const order = wave({ amplitude: 3, frequency: 1.5 })
    const controls: ReturnType<typeof play>[] = []

    const run = (): void => {
      controls.forEach((c) => c.cancel())
      controls.length = 0
      bars.forEach((bar, i) => {
        const delay = Math.max(0, order(i, bars.length)) * 35
        setTimeout(() => {
          controls.push(
            play(
              tween({ scaleY: [0.2, 1], opacity: [0.2, 1] }, { duration: 400, easing: easeInOut }),
              bar,
            ),
          )
        }, delay)
      })
    }

    run()
    const interval = setInterval(run, 2200)
    return () => {
      clearInterval(interval)
      controls.forEach((c) => c.cancel())
    }
  },
}
