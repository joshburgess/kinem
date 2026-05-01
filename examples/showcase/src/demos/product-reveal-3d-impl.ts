import { delay, easeOut, parallel, playValues, spring, stagger, tween } from "@kinem/core"
import * as THREE from "three"

interface SpecLabel {
  readonly el: HTMLDivElement
  readonly anchor: { x: number; y: number } // viewport-fraction
}

const SPECS: readonly { title: string; value: string; anchor: [number, number] }[] = [
  { title: "MODE", value: "TKNOT · 3,7", anchor: [0.13, 0.18] },
  { title: "MATERIAL", value: "PHYS · CC 1.0", anchor: [0.87, 0.18] },
  { title: "RESONANCE", value: "0.42 Q", anchor: [0.13, 0.84] },
  { title: "ORBIT", value: "AUTO · 6 °/s", anchor: [0.87, 0.84] },
]

export function mountProductReveal3d(stage: HTMLElement): () => void {
  const wrap = document.createElement("div")
  Object.assign(wrap.style, {
    position: "absolute",
    inset: "0",
    background:
      "radial-gradient(ellipse at 50% 35%, #1b1738 0%, #0a0814 70%), radial-gradient(ellipse at 80% 90%, #2a1d4a 0%, transparent 60%)",
    overflow: "hidden",
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

  // ---- DOM spec labels ----
  const labels: SpecLabel[] = SPECS.map((s) => {
    const el = document.createElement("div")
    el.innerHTML = `<div class="spec-title">${s.title}</div><div class="spec-value">${s.value}</div>`
    const isLeft = s.anchor[0] < 0.5
    Object.assign(el.style, {
      position: "absolute",
      // The anchor is the corner closest to the product. We position the
      // outer corner at the anchor and let content flow toward the edge.
      left: isLeft ? "0" : "auto",
      right: isLeft ? "auto" : "0",
      top: `${s.anchor[1] * 100}%`,
      transform: "translateY(-50%)",
      padding: "10px 18px",
      color: "rgba(232,236,244,0.92)",
      font: "500 12px ui-monospace, SF Mono, Menlo, monospace",
      letterSpacing: "0.18em",
      textAlign: isLeft ? "left" : "right",
      pointerEvents: "none",
      opacity: "0",
      willChange: "opacity, transform",
    })
    el.querySelectorAll(".spec-title").forEach((n) => {
      const node = n as HTMLElement
      Object.assign(node.style, {
        fontSize: "10px",
        color: "rgba(167,139,250,0.85)",
        textTransform: "uppercase",
        letterSpacing: "0.32em",
        marginBottom: "4px",
      })
    })
    el.querySelectorAll(".spec-value").forEach((n) => {
      const node = n as HTMLElement
      Object.assign(node.style, {
        fontSize: "13px",
        color: "rgba(232,236,244,0.95)",
        letterSpacing: "0.12em",
      })
    })
    wrap.appendChild(el)
    return { el, anchor: { x: s.anchor[0], y: s.anchor[1] } }
  })

  const replayBtn = document.createElement("button")
  replayBtn.textContent = "↻ replay"
  Object.assign(replayBtn.style, {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 18px",
    background: "rgba(167,139,250,0.12)",
    border: "1px solid rgba(167,139,250,0.35)",
    borderRadius: "999px",
    color: "rgba(232,236,244,0.85)",
    font: "600 11px ui-sans-serif, system-ui",
    letterSpacing: "0.32em",
    textTransform: "uppercase",
    cursor: "pointer",
    opacity: "0",
    transition: "opacity 240ms ease",
  })
  wrap.appendChild(replayBtn)

  // ---- Three.js setup ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 5, 18)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0x6878a8, 0.7))

  const key = new THREE.DirectionalLight(0xffffff, 1.5)
  key.position.set(4, 6, 5)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xa78bfa, 1.6)
  rim.position.set(-5, 2, -3)
  scene.add(rim)

  const accent = new THREE.PointLight(0x4dd6ff, 1.4, 20)
  accent.position.set(2, -2, 4)
  scene.add(accent)

  // The product mesh: a torus knot with a glossy lavender material.
  const knotGeo = new THREE.TorusKnotGeometry(1.0, 0.32, 220, 36, 3, 7)
  const knotMat = new THREE.MeshPhysicalMaterial({
    color: 0xc7b6ff,
    metalness: 0.65,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.5,
    sheenColor: new THREE.Color(0x7c9cff),
  })
  const knot = new THREE.Mesh(knotGeo, knotMat)
  knot.scale.setScalar(0.001)
  scene.add(knot)

  // Subtle inner halo so the dark bg has visual structure even before the
  // mesh scales up.
  const halo = (() => {
    const g = new THREE.RingGeometry(2.6, 2.62, 96)
    const m = new THREE.MeshBasicMaterial({
      color: 0x9c84ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(g, m)
    mesh.rotation.x = Math.PI / 2.05
    scene.add(mesh)
    return { mesh, geo: g, mat: m }
  })()

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

  // ---- Continuous render loop. Mesh rotation accumulates from a state var
  //      that the orbit phase increments each frame.
  let rafId = 0
  let orbiting = false
  let orbitStartTs = 0
  const ORBIT_SPEED_RAD_PER_S = (6 * Math.PI) / 180 // 6°/s
  let lastTs = performance.now()
  const render = (ts: number): void => {
    const dt = (ts - lastTs) / 1000
    lastTs = ts
    if (orbiting) {
      knot.rotation.y += ORBIT_SPEED_RAD_PER_S * dt
      // Wobble is anchored to orbit start so it begins at 0 and ramps in,
      // avoiding a snap when the intro hands off to the orbit phase.
      knot.rotation.x = Math.sin((ts - orbitStartTs) * 0.0004) * 0.18
    }
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(render)
  }
  rafId = requestAnimationFrame(render)

  // ---- Intro composition ----
  const CAM_DUR = 800
  const LABEL_DUR = 360
  const LABEL_GAP = 80

  // Camera fly-in: z 18→7, y 5→1.
  const cameraTween = tween({ z: [18, 7], y: [5, 1] } as const, {
    duration: CAM_DUR,
    easing: easeOut,
  })

  // Mesh scale-up with spring overshoot. Damping ratio ~0.4 gives a clear
  // overshoot. `restDisplacement` is loosened from the default 0.001 so
  // the spring ends close to when the eye stops noticing oscillation,
  // instead of trailing through a long imperceptible tail.
  const meshScale = spring({ s: [0, 1] } as const, {
    stiffness: 220,
    damping: 12,
    mass: 1,
    restDisplacement: 0.012,
    restVelocity: 0.012,
  })

  // Label entrance: each fades opacity 0→1 and slides 12px → 0px toward
  // its anchor. Stagger them with `each: 80`.
  const oneLabel = tween({ o: [0, 1], dy: [12, 0] } as const, {
    duration: LABEL_DUR,
    easing: easeOut,
  })
  const labelStagger = stagger(oneLabel, {
    each: LABEL_GAP,
    count: SPECS.length,
    from: "start",
  })

  // Three lanes in parallel, with delays so they cascade.
  // 0ms: camera flies in
  // 600ms: mesh starts springing up (slight overlap with camera tail)
  // 800ms: labels start cascading in
  const intro = parallel(cameraTween, delay(meshScale, 600), delay(labelStagger, 800))

  let activeHandle: { cancel(): void } | null = null

  const playIntro = (): void => {
    activeHandle?.cancel()
    orbiting = false
    knot.rotation.set(0, 0, 0)
    knot.scale.setScalar(0.001)
    camera.position.set(0, 5, 18)
    camera.lookAt(0, 0, 0)
    for (const lab of labels) {
      lab.el.style.opacity = "0"
      lab.el.style.transform = "translateY(calc(-50% + 12px))"
    }
    replayBtn.style.opacity = "0"
    replayBtn.style.pointerEvents = "none"

    const handle = playValues(
      intro,
      ([cam, mesh, labs]) => {
        camera.position.y = cam.y
        camera.position.z = cam.z
        camera.lookAt(0, 0, 0)
        knot.scale.setScalar(mesh.s)
        for (let i = 0; i < labs.length; i++) {
          const lab = labels[i]
          const v = labs[i]
          if (!lab || !v) continue
          lab.el.style.opacity = String(v.o)
          lab.el.style.transform = `translateY(calc(-50% + ${v.dy}px))`
        }
      },
      {
        onFinish: () => {
          // Snap mesh to exactly 1.0 in case the spring's final emitted
          // sample was a whisker off (the LUT's last sample is forced to 1
          // but rounding via setScalar can leave a 0.999/1.001 residual).
          knot.scale.setScalar(1)
          orbitStartTs = performance.now()
          orbiting = true
          replayBtn.style.opacity = "1"
          replayBtn.style.pointerEvents = "auto"
          activeHandle = null
        },
      },
    )
    activeHandle = handle
  }

  replayBtn.addEventListener("click", playIntro)

  // Slight pause so the user sees the dark frame before things move.
  const startTimer = window.setTimeout(playIntro, 300)

  return () => {
    window.clearTimeout(startTimer)
    cancelAnimationFrame(rafId)
    activeHandle?.cancel()
    replayBtn.removeEventListener("click", playIntro)
    ro.disconnect()
    knotGeo.dispose()
    knotMat.dispose()
    halo.geo.dispose()
    halo.mat.dispose()
    renderer.dispose()
  }
}
