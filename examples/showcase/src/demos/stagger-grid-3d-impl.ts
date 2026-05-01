import { type ValuesHandle, easeOut, fromGrid, keyframes, playValues, stagger } from "@kinem/core"
import * as THREE from "three"

const ROWS = 12
const COLS = 12
const TILE = 0.42
const GAP = 0.06
const PITCH = TILE + GAP

interface BlockState {
  readonly mesh: THREE.Mesh
  readonly baseY: number
  readonly hue: number
}

interface Hit {
  readonly row: number
  readonly col: number
}

export function mountStaggerGrid3d(stage: HTMLElement): () => void {
  const wrap = document.createElement("div")
  Object.assign(wrap.style, {
    position: "absolute",
    inset: "0",
    background: "radial-gradient(ellipse at 50% 30%, #18213d 0%, #060810 75%)",
    cursor: "crosshair",
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

  const hint = document.createElement("div")
  hint.textContent = "click anywhere"
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

  // ---- Three.js setup ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
  // Centered, tilted-down view so the whole grid frames comfortably.
  camera.position.set(0, 8, 10)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0x4a5a82, 0.85))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(4, 8, 5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x7c9cff, 0.7)
  fill.position.set(-6, 3, -2)
  scene.add(fill)

  // Floor plane (catches the shadow tones).
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0e1c, metalness: 0.2, roughness: 0.95 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.001
  scene.add(floor)

  // Build the grid.
  const blocks: BlockState[] = []
  const sharedGeo = new THREE.BoxGeometry(TILE, TILE, TILE)
  const offsetX = -((COLS - 1) * PITCH) / 2
  const offsetZ = -((ROWS - 1) * PITCH) / 2

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = (r + c) / (ROWS + COLS)
      const hue = 220 + t * 130
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue / 360, 0.65, 0.55),
        metalness: 0.5,
        roughness: 0.4,
      })
      const mesh = new THREE.Mesh(sharedGeo, mat)
      const baseY = TILE / 2
      mesh.position.set(offsetX + c * PITCH, baseY, offsetZ + r * PITCH)
      scene.add(mesh)
      blocks.push({ mesh, baseY, hue })
    }
  }

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

  // ---- Render loop (continuous, so click ripples animate) ----
  let rafId = 0
  const render = (): void => {
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(render)
  }
  rafId = requestAnimationFrame(render)

  // ---- Pointer → grid hit ----
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  // Plane at the top of the cubes for hit-testing (so a click "lands" on a cube top).
  const hitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE / 2)
  const hitPoint = new THREE.Vector3()

  const pickGridCell = (clientX: number, clientY: number): Hit | null => {
    const rect = wrap.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    if (!raycaster.ray.intersectPlane(hitPlane, hitPoint)) return null
    const col = Math.round((hitPoint.x - offsetX) / PITCH)
    const row = Math.round((hitPoint.z - offsetZ) / PITCH)
    return {
      row: Math.max(0, Math.min(ROWS - 1, row)),
      col: Math.max(0, Math.min(COLS - 1, col)),
    }
  }

  // ---- Ripple via stagger() + fromGrid() ----
  const liveHandles = new Set<ValuesHandle>()

  const ripple = (origin: Hit): void => {
    // One animation def per cell describing the bump: y rises, settles back,
    // and the cube spins a half-turn around its center. `lift` is a 3-stop
    // keyframes (rise then fall); `spin` is a single tween-style ramp.
    const oneCell = keyframes(
      { lift: [0, 1, 0], spin: [0, Math.PI / 2, Math.PI] },
      { duration: 720, easing: easeOut },
    )

    const wave = stagger(oneCell, {
      each: 22,
      count: ROWS * COLS,
      from: fromGrid({ rows: ROWS, cols: COLS, origin: [origin.row, origin.col] }),
    })

    const handle = playValues(
      wave,
      (vals) => {
        // `vals` is a readonly array, one entry per block, in the grid's
        // row-major order (matches our `blocks` array).
        for (let i = 0; i < vals.length; i++) {
          const v = vals[i]
          const b = blocks[i]
          if (!v || !b) continue
          b.mesh.position.y = b.baseY + v.lift * 0.9
          b.mesh.rotation.y = v.spin
        }
      },
      {
        onFinish: () => {
          // Snap to rest in case interpolation left a tiny residual.
          for (const b of blocks) {
            b.mesh.position.y = b.baseY
            b.mesh.rotation.y = 0
          }
          liveHandles.delete(handle)
        },
      },
    )
    liveHandles.add(handle)
  }

  const onPointerDown = (e: PointerEvent): void => {
    const cell = pickGridCell(e.clientX, e.clientY)
    if (!cell) return
    // Cancel previous ripples so the new click takes over cleanly.
    for (const h of liveHandles) h.cancel()
    liveHandles.clear()
    ripple(cell)
  }
  wrap.addEventListener("pointerdown", onPointerDown)

  // Auto-trigger an opening ripple from the corner.
  const autoTimer = window.setTimeout(() => ripple({ row: 1, col: 1 }), 300)

  return () => {
    window.clearTimeout(autoTimer)
    cancelAnimationFrame(rafId)
    wrap.removeEventListener("pointerdown", onPointerDown)
    for (const h of liveHandles) h.cancel()
    liveHandles.clear()
    ro.disconnect()
    sharedGeo.dispose()
    blocks.forEach((b) => (b.mesh.material as THREE.Material).dispose())
    floor.geometry.dispose()
    ;(floor.material as THREE.Material).dispose()
    renderer.dispose()
  }
}
