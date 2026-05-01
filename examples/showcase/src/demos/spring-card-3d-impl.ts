import {
  type ValuesHandle,
  createVelocityTracker,
  playValues,
  spring,
  velocityFromSpan,
} from "@kinem/core"
import * as THREE from "three"

const RAD_PER_PIXEL = 0.008
const YAW_LIMIT = Math.PI / 2.6 // ~70deg
const PITCH_LIMIT = Math.PI / 3.2 // ~56deg

// Spring tuning. Damping ratio = damping / (2*sqrt(stiffness*mass)).
// At ~0.35 the spring overshoots ~30% on each oscillation, giving a clear
// visible bounce instead of a stiff settle.
const SPRING_OPTS = { stiffness: 180, damping: 9, mass: 1 } as const

export function mountSpringCard3d(stage: HTMLElement): () => void {
  const wrap = document.createElement("div")
  Object.assign(wrap.style, {
    position: "absolute",
    inset: "0",
    background: "radial-gradient(ellipse at 50% 30%, #1c1638 0%, #07060e 70%)",
    cursor: "grab",
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
  })
  stage.appendChild(wrap)

  const canvas = document.createElement("canvas")
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
  })
  wrap.appendChild(canvas)

  const hint = document.createElement("div")
  hint.textContent = "drag · flick to bounce"
  Object.assign(hint.style, {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "rgba(232,236,244,0.55)",
    fontSize: "11px",
    letterSpacing: "0.32em",
    textTransform: "uppercase",
    fontWeight: "600",
    pointerEvents: "none",
  })
  wrap.appendChild(hint)

  const readout = document.createElement("div")
  Object.assign(readout.style, {
    position: "absolute",
    top: "24px",
    right: "32px",
    color: "rgba(232,236,244,0.7)",
    font: "500 11px ui-monospace, SF Mono, Menlo, monospace",
    letterSpacing: "0.06em",
    pointerEvents: "none",
    textAlign: "right",
    lineHeight: "1.6",
  })
  wrap.appendChild(readout)

  // ---- Three.js setup ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
  camera.position.set(0, 0, 12)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0x4a5a82, 0.55))

  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(3, 4, 6)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xa78bfa, 1.4)
  rim.position.set(-5, 2, -3)
  scene.add(rim)

  const fill = new THREE.PointLight(0x7c9cff, 1.0, 30)
  fill.position.set(0, -3, 5)
  scene.add(fill)

  // Card group. We rotate the group so any child decoration moves with it.
  const card = new THREE.Group()
  scene.add(card)

  const CARD_W = 2.6
  const CARD_H = 3.7
  const CARD_D = 0.06

  // Front face: a CanvasTexture so the asymmetric "K" makes the rotation
  // direction obvious. Rendered at 2x for retina sharpness.
  const tex = (() => {
    const c = document.createElement("canvas")
    c.width = 512
    c.height = 720
    const g = c.getContext("2d")
    if (g) {
      // Background: subtle vertical gradient.
      const grad = g.createLinearGradient(0, 0, 0, c.height)
      grad.addColorStop(0, "#fafafa")
      grad.addColorStop(1, "#dddde6")
      g.fillStyle = grad
      g.fillRect(0, 0, c.width, c.height)

      // Big monogram.
      g.fillStyle = "#1a1838"
      g.font = "bold 380px ui-sans-serif, system-ui, -apple-system"
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillText("K", c.width / 2, c.height / 2 - 20)

      // Top and bottom labels.
      g.fillStyle = "rgba(26,24,56,0.55)"
      g.font = "600 28px ui-sans-serif, system-ui"
      g.textAlign = "left"
      g.fillText("KINEM", 36, 56)
      g.textAlign = "right"
      g.fillText("◆ 001", c.width - 36, 56)
      g.textAlign = "center"
      g.font = "500 22px ui-sans-serif, system-ui"
      g.fillText("spring · physics · 3D", c.width / 2, c.height - 60)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = renderer.capabilities.getMaxAnisotropy()
    return t
  })()

  const frontMat = new THREE.MeshPhysicalMaterial({
    map: tex,
    metalness: 0.35,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
  })
  const sideMat = new THREE.MeshPhysicalMaterial({
    color: 0x9ca3d8,
    metalness: 0.85,
    roughness: 0.25,
  })
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b7adc,
    metalness: 0.55,
    roughness: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
  })

  const cardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D),
    // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back).
    [sideMat, sideMat, sideMat, sideMat, frontMat, backMat],
  )
  card.add(cardMesh)

  // ---- Resize ----
  const resize = (): void => {
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(wrap)
  resize()

  // ---- Render loop ----
  let rafId = 0
  const render = (): void => {
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(render)
  }
  rafId = requestAnimationFrame(render)

  // ---- State ----
  let yaw = 0 // rotation.y (drag horizontally)
  let pitch = 0 // rotation.x (drag vertically, inverted)
  let dragging = false
  let pointerId = -1
  let downX = 0
  let downY = 0
  let yawAtDown = 0
  let pitchAtDown = 0

  const tracker = createVelocityTracker({ windowMs: 80 })

  let yawHandle: ValuesHandle | null = null
  let pitchHandle: ValuesHandle | null = null

  const cancelSprings = (): void => {
    yawHandle?.cancel()
    pitchHandle?.cancel()
    yawHandle = null
    pitchHandle = null
  }

  let lastReleaseSpeed = 0

  const apply = (): void => {
    card.rotation.y = yaw
    card.rotation.x = pitch
    updateReadout()
  }

  const updateReadout = (): void => {
    const yawDeg = (yaw * 180) / Math.PI
    const pitchDeg = (pitch * 180) / Math.PI
    readout.textContent =
      `yaw   ${yawDeg.toFixed(1).padStart(6, " ")}°\n` +
      `pitch ${pitchDeg.toFixed(1).padStart(6, " ")}°\n` +
      `release ${lastReleaseSpeed.toFixed(2).padStart(5, " ")} rad/s`
  }

  const onDown = (e: PointerEvent): void => {
    cancelSprings()
    dragging = true
    pointerId = e.pointerId
    downX = e.clientX
    downY = e.clientY
    yawAtDown = yaw
    pitchAtDown = pitch
    wrap.style.cursor = "grabbing"
    wrap.setPointerCapture(pointerId)
    tracker.reset()
    tracker.record({ x: e.clientX, y: e.clientY, time: performance.now() })
  }

  const clamp = (v: number, lim: number): number => (v > lim ? lim : v < -lim ? -lim : v)

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return
    const dx = e.clientX - downX
    const dy = e.clientY - downY
    yaw = clamp(yawAtDown + dx * RAD_PER_PIXEL, YAW_LIMIT)
    // Drag down → tilt the top of the card away (rotation.x negative).
    pitch = clamp(pitchAtDown - dy * RAD_PER_PIXEL, PITCH_LIMIT)
    tracker.record({ x: e.clientX, y: e.clientY, time: performance.now() })
    apply()
  }

  const onUp = (): void => {
    if (!dragging) return
    dragging = false
    wrap.style.cursor = "grab"
    try {
      wrap.releasePointerCapture(pointerId)
    } catch {
      // Pointer may already be released; ignore.
    }

    // Velocity tracker emits px/ms, scale to px/s, then to rad/s using the
    // same gesture mapping. y inverts because pitch did.
    const v = tracker.velocity()
    const vYaw = v.x * 1000 * RAD_PER_PIXEL
    const vPitch = -v.y * 1000 * RAD_PER_PIXEL

    // Two springs, one per axis. Each carries its own initial velocity, so a
    // mostly-horizontal flick spins yaw with no pitch wobble (and vice versa).
    // Spring's `velocity` opt is in normalized units (per second of the
    // [from, to] travel), so we divide by the displacement magnitude.
    const yawSpan = 0 - yaw
    const pitchSpan = 0 - pitch

    if (Math.abs(yaw) > 1e-4 || Math.abs(vYaw) > 0.05) {
      const def = spring(
        { a: [yaw, 0] },
        { ...SPRING_OPTS, velocity: velocityFromSpan(vYaw, yawSpan) },
      )
      yawHandle = playValues(
        def,
        (vals) => {
          yaw = vals.a
          card.rotation.y = yaw
          updateReadout()
        },
        {
          onFinish: () => {
            yawHandle = null
          },
        },
      )
    }
    if (Math.abs(pitch) > 1e-4 || Math.abs(vPitch) > 0.05) {
      const def = spring(
        { a: [pitch, 0] },
        { ...SPRING_OPTS, velocity: velocityFromSpan(vPitch, pitchSpan) },
      )
      pitchHandle = playValues(
        def,
        (vals) => {
          pitch = vals.a
          card.rotation.x = pitch
          updateReadout()
        },
        {
          onFinish: () => {
            pitchHandle = null
          },
        },
      )
    }

    lastReleaseSpeed = Math.hypot(vYaw, vPitch)
    updateReadout()
  }

  wrap.addEventListener("pointerdown", onDown)
  wrap.addEventListener("pointermove", onMove)
  wrap.addEventListener("pointerup", onUp)
  wrap.addEventListener("pointercancel", onUp)

  apply()

  // ---- Auto-intro: a small flick so the demo isn't static on first paint.
  const introTimer = window.setTimeout(() => {
    if (yawHandle || pitchHandle || dragging) return
    yaw = 0.45
    pitch = -0.18
    apply()
    const yawSpan = 0 - yaw
    const pitchSpan = 0 - pitch
    lastReleaseSpeed = Math.hypot(3, 1.2)
    yawHandle = playValues(
      spring({ a: [yaw, 0] }, { ...SPRING_OPTS, velocity: velocityFromSpan(-3, yawSpan) }),
      (vals) => {
        yaw = vals.a
        card.rotation.y = yaw
        updateReadout()
      },
      {
        onFinish: () => {
          yawHandle = null
        },
      },
    )
    pitchHandle = playValues(
      spring({ a: [pitch, 0] }, { ...SPRING_OPTS, velocity: velocityFromSpan(1.2, pitchSpan) }),
      (vals) => {
        pitch = vals.a
        card.rotation.x = pitch
        updateReadout()
      },
      {
        onFinish: () => {
          pitchHandle = null
        },
      },
    )
  }, 360)

  return () => {
    window.clearTimeout(introTimer)
    cancelAnimationFrame(rafId)
    wrap.removeEventListener("pointerdown", onDown)
    wrap.removeEventListener("pointermove", onMove)
    wrap.removeEventListener("pointerup", onUp)
    wrap.removeEventListener("pointercancel", onUp)
    cancelSprings()
    ro.disconnect()
    cardMesh.geometry.dispose()
    frontMat.dispose()
    sideMat.dispose()
    backMat.dispose()
    tex.dispose()
    renderer.dispose()
  }
}
