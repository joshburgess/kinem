import type { Demo } from "./demo"
import { cardStack } from "./demos/card-stack"
import { magneticNav } from "./demos/magnetic-nav"
import { panMomentum } from "./demos/pan-momentum"
import { particleField } from "./demos/particle-field"
import { pinchZoom } from "./demos/pinch-zoom"
import { pressCharge } from "./demos/press-charge"
import { scrollHero } from "./demos/scroll-hero"
import { shaderReveal } from "./demos/shader-reveal"
import { tapRipple } from "./demos/tap-ripple"
import { textShatter } from "./demos/text-shatter"

const demos: readonly Demo[] = [
  tapRipple,
  pressCharge,
  panMomentum,
  pinchZoom,
  particleField,
  textShatter,
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
