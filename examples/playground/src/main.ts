import type { Example } from "./example"
import { canvasDraw } from "./examples/canvas-draw"
import { dragGesture } from "./examples/drag-gesture"
import { easingShowcase } from "./examples/easing-showcase"
import { hoverGesture } from "./examples/hover-gesture"
import { keyframesStops } from "./examples/keyframes-stops"
import { parallelComposition } from "./examples/parallel-composition"
import { scrollSynced } from "./examples/scroll-synced"
import { sequenceComposition } from "./examples/sequence-composition"
import { springDrop } from "./examples/spring-drop"
import { staggerCenter } from "./examples/stagger-center"
import { staggerGrid } from "./examples/stagger-grid"
import { staggerLinear } from "./examples/stagger-linear"
import { staggerWave } from "./examples/stagger-wave"
import { svgStrokeDraw } from "./examples/svg-stroke-draw"
import { textReveal } from "./examples/text-reveal"
import { timelineOrchestration } from "./examples/timeline-orchestration"
import { tweenBasic } from "./examples/tween-basic"
import { tweenMulti } from "./examples/tween-multi"
import { webglUniforms } from "./examples/webgl-uniforms"

const examples: readonly Example[] = [
  tweenBasic,
  tweenMulti,
  easingShowcase,
  springDrop,
  keyframesStops,
  parallelComposition,
  sequenceComposition,
  staggerLinear,
  staggerCenter,
  staggerGrid,
  staggerWave,
  timelineOrchestration,
  scrollSynced,
  dragGesture,
  hoverGesture,
  svgStrokeDraw,
  textReveal,
  canvasDraw,
  webglUniforms,
]

const grid = document.getElementById("grid") as HTMLElement

for (const ex of examples) {
  const card = document.createElement("article")
  card.className = "card"

  const title = document.createElement("h2")
  title.textContent = ex.title
  card.appendChild(title)

  const desc = document.createElement("p")
  desc.textContent = ex.description
  card.appendChild(desc)

  const stage = document.createElement("div")
  stage.className = "stage"
  if (ex.tall) stage.classList.add("tall")
  if (ex.wide) card.classList.add("wide")
  card.appendChild(stage)

  grid.appendChild(card)

  try {
    ex.mount(stage)
  } catch (err) {
    const msg = document.createElement("pre")
    msg.textContent = `failed: ${(err as Error).message}`
    msg.style.color = "#f87171"
    stage.appendChild(msg)
  }
}
