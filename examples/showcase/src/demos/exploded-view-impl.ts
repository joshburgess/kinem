import { easeInOut, scroll, tween } from "@kinem/core"
import * as THREE from "three"

interface Layer {
  readonly name: string
  readonly detail: string
  readonly color: number
  readonly thickness: number
  /** Final spread offset along Y, in scene units. Positive moves up. */
  readonly spread: number
  /** Side the callout sits on. */
  readonly side: "left" | "right"
}

const LAYERS: readonly Layer[] = [
  {
    name: "Cover glass",
    detail: "Anti-reflective, oleophobic",
    color: 0xe8ecf4,
    thickness: 0.04,
    spread: 2.4,
    side: "right",
  },
  {
    name: "OLED panel",
    detail: "120 Hz, 1B colors",
    color: 0x1c2742,
    thickness: 0.06,
    spread: 1.45,
    side: "left",
  },
  {
    name: "Mid-frame",
    detail: "Recycled aluminum",
    color: 0x6b7280,
    thickness: 0.08,
    spread: 0.5,
    side: "right",
  },
  {
    name: "Battery",
    detail: "4500 mAh, USB-C charge",
    color: 0x2dd4bf,
    thickness: 0.18,
    spread: -0.6,
    side: "left",
  },
  {
    name: "Logic board",
    detail: "SoC + RAM + modem",
    color: 0x7c9cff,
    thickness: 0.08,
    spread: -1.6,
    side: "right",
  },
  {
    name: "Back cover",
    detail: "Forged carbon weave",
    color: 0x111827,
    thickness: 0.06,
    spread: -2.55,
    side: "left",
  },
]

const STACK_GAP = 0.02

export function mountExplodedView(stage: HTMLElement): () => void {
  // Outer viewport (the scrollable region inside the demo stage).
  const viewport = document.createElement("div")
  Object.assign(viewport.style, {
    position: "absolute",
    inset: "0",
    overflow: "auto",
    background: "radial-gradient(ellipse at 50% 30%, #14182a 0%, #07080b 75%)",
    scrollbarWidth: "thin",
    perspective: "1200px",
  })
  stage.appendChild(viewport)

  // Pinned scene: stays centered while the spacer below scrolls.
  // Sticky height is resized to match the viewport (set in `resize` below).
  // We can't use `height: 100%` because the parent `anchor` is 400% tall, so
  // that would make sticky 4 viewport-heights and the canvas way too big.
  const sticky = document.createElement("div")
  Object.assign(sticky.style, {
    position: "sticky",
    top: "0",
    width: "100%",
    pointerEvents: "none",
    zIndex: "1",
  })

  // The scroll anchor: spacer that drives progress.
  const anchor = document.createElement("div")
  Object.assign(anchor.style, {
    position: "relative",
    width: "100%",
    // 4 viewport-heights so the user has plenty of room to scrub.
    height: "400%",
  })

  // Canvas hosts three.js.
  const canvas = document.createElement("canvas")
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
  })
  sticky.appendChild(canvas)

  // Overlay layer for DOM callouts (drawn on top of canvas).
  const overlay = document.createElement("div")
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
  })
  sticky.appendChild(overlay)

  const hint = document.createElement("div")
  hint.textContent = "scroll inside the frame"
  Object.assign(hint.style, {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "rgba(232,236,244,0.45)",
    fontSize: "11px",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    fontWeight: "600",
    zIndex: "2",
  })
  sticky.appendChild(hint)

  anchor.appendChild(sticky)
  viewport.appendChild(anchor)

  // ---- Three.js setup ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(3.4, 1.0, 6.2)
  camera.lookAt(0, 0, 0)

  // Lights
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x7c9cff, 0.9)
  rim.position.set(-5, -2, -3)
  scene.add(rim)
  scene.add(new THREE.AmbientLight(0x404a66, 0.7))

  // Subtle floor reflection feel via a large faint plane behind.
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: 0x0a0d18 }),
  )
  backdrop.position.z = -8
  scene.add(backdrop)

  // Build layers as rounded plates (BoxGeometry is fine and free).
  const PLATE_W = 2.2
  const PLATE_H = 3.8
  const meshes: THREE.Mesh[] = []
  const baseY: number[] = []

  // Stack centered on y=0; first layer sits highest.
  let cursor = 0
  const heights = LAYERS.map((l) => l.thickness)
  const totalHeight = heights.reduce((a, b) => a + b, 0) + STACK_GAP * (LAYERS.length - 1)
  cursor = totalHeight / 2

  LAYERS.forEach((layer) => {
    const geo = new THREE.BoxGeometry(PLATE_W, layer.thickness, PLATE_H, 1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({
      color: layer.color,
      metalness: 0.55,
      roughness: 0.35,
    })
    const mesh = new THREE.Mesh(geo, mat)
    const y = cursor - layer.thickness / 2
    mesh.position.set(0, y, 0)
    scene.add(mesh)
    meshes.push(mesh)
    baseY.push(y)
    cursor -= layer.thickness + STACK_GAP
  })

  // ---- Build DOM callouts ----
  interface Callout {
    readonly el: HTMLElement
    readonly meshIndex: number
    readonly side: "left" | "right"
  }
  const callouts: Callout[] = []
  LAYERS.forEach((layer, i) => {
    const el = document.createElement("div")
    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;${layer.side === "left" ? "flex-direction:row-reverse;" : ""}">
          <div style="width:36px;height:1px;background:linear-gradient(${layer.side === "left" ? "to left" : "to right"}, rgba(232,236,244,0.7), rgba(232,236,244,0))"></div>
          <div>
            <div style="font:700 12px/1.2 ui-sans-serif,system-ui,sans-serif;color:#e8ecf4;letter-spacing:0.02em">${layer.name}</div>
            <div style="font:500 11px/1.3 ui-sans-serif,system-ui,sans-serif;color:rgba(232,236,244,0.55);margin-top:2px">${layer.detail}</div>
          </div>
        </div>
      `
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      opacity: "0",
      transform: "translate(-50%, -50%)",
      willChange: "transform, opacity",
      whiteSpace: "nowrap",
    })
    overlay.appendChild(el)
    callouts.push({ el, meshIndex: i, side: layer.side })
  })

  // ---- Resize handling ----
  const resize = (): void => {
    const w = viewport.clientWidth
    const h = viewport.clientHeight
    if (w === 0 || h === 0) return
    sticky.style.height = `${h}px`
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(viewport)
  resize()

  // ---- Per-frame update from scroll progress ----
  const tmpVec = new THREE.Vector3()
  const update = (p: number): void => {
    // Ease the raw scroll progress so the feel matches the visual punch.
    const eased = easeInOut(p)

    // Translate each layer outward, with a subtle stagger so motion ripples.
    meshes.forEach((m, i) => {
      const stagger = Math.min(1, eased * 1.4 - i * 0.05)
      const t = Math.max(0, stagger)
      m.position.y = baseY[i]! + LAYERS[i]!.spread * t
      // Rotate slightly so faces catch the rim light.
      m.rotation.x = t * 0.04 * (i % 2 === 0 ? 1 : -1)
    })

    // Camera arcs back and up as parts fly apart.
    const camR = 6.2 + eased * 1.6
    const camY = 1.0 + eased * 0.8
    const camAngle = Math.PI / 7 + eased * 0.18
    camera.position.set(Math.sin(camAngle) * camR, camY, Math.cos(camAngle) * camR)
    camera.lookAt(0, 0, 0)

    // Project each mesh center to screen space and place its callout.
    const w = sticky.clientWidth
    const h = sticky.clientHeight
    callouts.forEach(({ el, meshIndex, side }) => {
      const mesh = meshes[meshIndex]!
      // Edge of the plate on the side we want the callout to appear.
      tmpVec.set(side === "right" ? PLATE_W / 2 : -PLATE_W / 2, 0, 0)
      mesh.localToWorld(tmpVec)
      tmpVec.project(camera)
      const sx = (tmpVec.x * 0.5 + 0.5) * w
      const sy = (-tmpVec.y * 0.5 + 0.5) * h
      const offset = side === "right" ? 80 : -80
      el.style.transform = `translate(calc(${sx + offset}px - ${side === "right" ? "0%" : "100%"}), calc(${sy}px - 50%))`
      // Fade in once this part has separated meaningfully.
      const localT = Math.max(0, Math.min(1, eased * 1.4 - meshIndex * 0.06 - 0.1))
      el.style.opacity = String(localT)
    })

    // Fade the scroll hint as the user scrolls.
    hint.style.opacity = String(Math.max(0, 1 - eased * 4))

    renderer.render(scene, camera)
  }

  // Initial render so the scene is visible before any scroll event fires.
  update(0)

  // Drive everything via kinem's scroll-linked driver. The animation
  // def itself targets a hidden DOM node (so kinem has somewhere to
  // commit values), but the visible work happens in onProgress.
  const def = tween({ _: [0, 1] }, { duration: 1000 })
  const handle = scroll(def, anchor, {
    sync: true,
    // Cover the whole spacer: progress 0 when the spacer top hits the
    // viewport top, progress 1 when its bottom hits the viewport bottom.
    trigger: { start: "top top", end: "bottom bottom" },
    onProgress: update,
    source: {
      getScrollY: () => viewport.scrollTop,
      getViewportHeight: () => viewport.clientHeight,
      getRect: (el) => {
        const r = (el as unknown as Element).getBoundingClientRect()
        const vr = viewport.getBoundingClientRect()
        return { top: r.top - vr.top + viewport.scrollTop, height: r.height }
      },
      onScroll: (cb) => {
        viewport.addEventListener("scroll", cb, { passive: true })
        return () => viewport.removeEventListener("scroll", cb)
      },
      onResize: (cb) => {
        window.addEventListener("resize", cb)
        return () => window.removeEventListener("resize", cb)
      },
    },
  })

  return () => {
    handle.cancel()
    ro.disconnect()
    meshes.forEach((m) => {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    })
    backdrop.geometry.dispose()
    ;(backdrop.material as THREE.Material).dispose()
    renderer.dispose()
  }
}
