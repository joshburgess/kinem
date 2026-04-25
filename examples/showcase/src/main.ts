import type { Demo } from "./demo"
import { cardStack } from "./demos/card-stack"
import { cascadeGrid } from "./demos/cascade-grid"
import { cometTrail } from "./demos/comet-trail"
import { confettiBurst } from "./demos/confetti-burst"
import { cubeWall } from "./demos/cube-wall"
import { galaxySpiral } from "./demos/galaxy-spiral"
import { gooDrag } from "./demos/goo-drag"
import { heatShimmer } from "./demos/heat-shimmer"
import { holoCard } from "./demos/holo-card"
import { liquidCursor } from "./demos/liquid-cursor"
import { liquidMenu } from "./demos/liquid-menu"
import { magneticNav } from "./demos/magnetic-nav"
import { meshGradient } from "./demos/mesh-gradient"
import { orbitDance } from "./demos/orbit-dance"
import { panMomentum } from "./demos/pan-momentum"
import { particleField } from "./demos/particle-field"
import { pathFlight } from "./demos/path-flight"
import { pinchZoom } from "./demos/pinch-zoom"
import { pressCharge } from "./demos/press-charge"
import { ribbonTrail } from "./demos/ribbon-trail"
import { scrollHero } from "./demos/scroll-hero"
import { shaderReveal } from "./demos/shader-reveal"
import { shapeMorph } from "./demos/shape-morph"
import { starfieldWarp } from "./demos/starfield-warp"
import { tapRipple } from "./demos/tap-ripple"
import { textShatter } from "./demos/text-shatter"
import { tossCard } from "./demos/toss-card"

const demos: readonly Demo[] = [
  tapRipple,
  pressCharge,
  panMomentum,
  pinchZoom,
  tossCard,
  holoCard,
  liquidCursor,
  meshGradient,
  confettiBurst,
  gooDrag,
  pathFlight,
  cometTrail,
  ribbonTrail,
  orbitDance,
  galaxySpiral,
  starfieldWarp,
  shapeMorph,
  cascadeGrid,
  cubeWall,
  liquidMenu,
  particleField,
  textShatter,
  heatShimmer,
  cardStack,
  scrollHero,
  shaderReveal,
  magneticNav,
]

const stage = document.getElementById("stage") as HTMLElement
const nav = document.getElementById("nav") as HTMLElement

// Build nav
const header = document.createElement("header")
header.innerHTML = "<h1>Kinem Showcase</h1><p>Flashy demos built with @kinem/core</p>"
nav.appendChild(header)

const groups = new Map<string, Demo[]>()
for (const d of demos) {
  const list = groups.get(d.group) ?? []
  list.push(d)
  groups.set(d.group, list)
}

const linkByHash = new Map<string, HTMLAnchorElement>()
for (const [group, list] of groups) {
  const section = document.createElement("div")
  section.className = "section"
  section.textContent = group
  nav.appendChild(section)
  for (const d of list) {
    const a = document.createElement("a")
    a.href = `#${d.id}`
    a.innerHTML = `${d.title}<small>${d.blurb.split(".")[0]}</small>`
    nav.appendChild(a)
    linkByHash.set(d.id, a)
  }
}

let cleanup: (() => void) | null = null

const mount = (id: string): void => {
  const demo = demos.find((d) => d.id === id) ?? demos[0]
  if (!demo) return

  // Clean previous
  cleanup?.()
  cleanup = null
  stage.innerHTML = ""

  // Title bar
  const title = document.createElement("div")
  title.className = "demo-title"
  title.innerHTML = `<h2>${demo.title}</h2><p>${demo.blurb}</p>`
  stage.appendChild(title)

  // Mount
  cleanup = demo.mount(stage)

  // Highlight active link
  linkByHash.forEach((a, key) => {
    a.classList.toggle("active", key === demo.id)
  })
}

const handleHash = (): void => {
  const id = location.hash.replace(/^#/, "") || demos[0]?.id || ""
  mount(id)
}

window.addEventListener("hashchange", handleHash)
handleHash()
