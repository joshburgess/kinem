import { easeInOut, play, strokeDraw } from "@kinem/core"
import type { Example } from "../example"

const SVG_NS = "http://www.w3.org/2000/svg"

export const svgStrokeDraw: Example = {
  id: "svg-stroke-draw",
  title: "SVG strokeDraw()",
  description: "Draw a path on, then retract it. Uses stroke-dasharray + stroke-dashoffset.",
  mount(stage) {
    const svg = document.createElementNS(SVG_NS, "svg")
    svg.setAttribute("viewBox", "0 0 200 120")
    svg.style.width = "100%"
    svg.style.height = "100%"
    stage.appendChild(svg)

    const path = document.createElementNS(SVG_NS, "path")
    path.setAttribute("d", "M10,100 Q50,10 100,60 T190,30")
    path.setAttribute("stroke", "#7c9cff")
    path.setAttribute("stroke-width", "3")
    path.setAttribute("fill", "none")
    path.setAttribute("stroke-linecap", "round")
    svg.appendChild(path)

    const len = (path as SVGGeometryElement).getTotalLength()
    let reverse = false
    let ctrl = play(strokeDraw({ pathLength: len, duration: 1200, reverse }), path)
    const interval = setInterval(() => {
      ctrl.cancel()
      reverse = !reverse
      ctrl = play(
        strokeDraw({ pathLength: len, duration: 1200, reverse }),
        path,
      )
    }, 1500)

    // reference to quiet the linter on the optional import
    void easeInOut

    return () => {
      clearInterval(interval)
      ctrl.cancel()
    }
  },
}
