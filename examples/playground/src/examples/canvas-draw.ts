import { easeInOut, playCanvas, tween } from "kinem"
import type { Example } from "../example"

export const canvasDraw: Example = {
  id: "canvas-draw",
  title: "playCanvas()",
  description: "Commit callback receives interpolated values; we draw to Canvas 2D.",
  mount(stage) {
    const canvas = document.createElement("canvas")
    const dpr = window.devicePixelRatio || 1
    const resize = (): void => {
      canvas.width = stage.clientWidth * dpr
      canvas.height = stage.clientHeight * dpr
      canvas.style.width = `${stage.clientWidth}px`
      canvas.style.height = `${stage.clientHeight}px`
    }
    resize()
    stage.appendChild(canvas)
    const ctx = canvas.getContext("2d")!
    ctx.scale(dpr, dpr)

    const run = (): ReturnType<typeof playCanvas> =>
      playCanvas(
        tween({ x: [0, 1], hue: [180, 320] }, { duration: 1400, easing: easeInOut }),
        (v) => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const w = stage.clientWidth
          const h = stage.clientHeight
          const r = 32
          const cx = r + v.x * (w - 2 * r)
          const cy = h / 2 + Math.sin(v.x * Math.PI * 2) * 30
          ctx.fillStyle = `hsl(${v.hue} 80% 60%)`
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
        },
      )

    let ctrl = run()
    const interval = setInterval(() => {
      ctrl.cancel()
      ctrl = run()
    }, 1700)

    const onResize = (): void => resize()
    window.addEventListener("resize", onResize)

    return () => {
      clearInterval(interval)
      ctrl.cancel()
      window.removeEventListener("resize", onResize)
    }
  },
}
