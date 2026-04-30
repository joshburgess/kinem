import { type ValuesHandle, easeInOut, playValues, tween } from "@kinem/core"
import Cube from "cubejs"
import type { Demo } from "../demo"

// 3D Rubik's cube. Each cubie is a div with six face stickers; the
// whole assembly lives inside a `transform-style: preserve-3d` parent
// with a tilted camera. Each face turn is a kinem `tween` that drives
// the 9 affected cubies' rotation around the face axis; on settle, we
// commit the rotation into each cubie's accumulated matrix and snap
// its slot index. The Solve button extracts the current state into a
// 54-char facelet string and hands it to cubejs's two-phase Kociemba
// solver; the returned move sequence is queued through the same
// per-quarter-turn animation pipeline.

type Face = "U" | "D" | "L" | "R" | "F" | "B"
type Move = { face: Face; dir: 1 | -1 }

const CUBIE = 56 // px
const GAP = 2
const STEP = CUBIE + GAP
const MOVE_MS = 220

// Sticker palette (classic Rubik's). We use a screen-y CSS coord system:
// +X right, +Y down, +Z toward viewer. So D (down) is at +Y and U (up)
// is at -Y. Names below match Rubik's notation; positions match CSS.
const STICKER: Record<Face, string> = {
  U: "#f5f5f5", // white, -Y
  D: "#ffd500", // yellow, +Y
  L: "#ff8a00", // orange, -X
  R: "#c41e3a", // red, +X
  F: "#009b48", // green, +Z
  B: "#0046ad", // blue, -Z
}

// For each face: which axis it lives on, and which slot value (-1, 0, +1)
// identifies cubies on that face. Layer is in our CSS coord system, so
// U (up) = -1 on the Y axis.
const FACE_INFO: Record<Face, { axis: 0 | 1 | 2; layer: -1 | 1; spinSign: 1 | -1 }> = {
  R: { axis: 0, layer: 1, spinSign: 1 },
  L: { axis: 0, layer: -1, spinSign: -1 },
  D: { axis: 1, layer: 1, spinSign: 1 },
  U: { axis: 1, layer: -1, spinSign: -1 },
  F: { axis: 2, layer: 1, spinSign: 1 },
  B: { axis: 2, layer: -1, spinSign: -1 },
}

// 3x3 matrix, row-major: m[row*3 + col].
type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

const ID3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const

function mul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9) as number[]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += a[i * 3 + k]! * b[k * 3 + j]!
      out[i * 3 + j] = s
    }
  }
  return out as unknown as Mat3
}

function applyV(m: Mat3, v: readonly [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

// Apply transpose of m to v. For rotation matrices R^T = R^-1, so this
// turns a world-space direction into the cubie's local frame.
function applyVT(m: Mat3, v: readonly [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ]
}

function rot(axis: 0 | 1 | 2, rad: number): Mat3 {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c] as const
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c] as const
  return [c, -s, 0, s, c, 0, 0, 0, 1] as const
}

// CSS matrix3d is column-major: m00 m10 m20 m30, m01 m11 m21 m31, ...
function toCss(r: Mat3, t: readonly [number, number, number]): string {
  return `matrix3d(${r[0]},${r[3]},${r[6]},0,${r[1]},${r[4]},${r[7]},0,${r[2]},${r[5]},${r[8]},0,${t[0]},${t[1]},${t[2]},1)`
}

interface Cubie {
  el: HTMLDivElement
  // Slot in {-1, 0, 1}^3, updated after each turn settles.
  slot: [number, number, number]
  // Accumulated rotation around cube center.
  rotation: Mat3
}

function buildCubie(home: readonly [number, number, number]): Cubie {
  const el = document.createElement("div")
  Object.assign(el.style, {
    position: "absolute",
    left: `${-CUBIE / 2}px`,
    top: `${-CUBIE / 2}px`,
    width: `${CUBIE}px`,
    height: `${CUBIE}px`,
    transformStyle: "preserve-3d",
    willChange: "transform",
  })

  const half = CUBIE / 2
  // Six face stickers. Only the ones whose home coord is on the cube
  // surface get a real color; interior faces stay near-black so the
  // gap between cubies looks like the classic plastic grid, not a void.
  const faces: Array<[Face, string]> = [
    ["R", `translate3d(${half}px, 0, 0) rotateY(90deg)`],
    ["L", `translate3d(${-half}px, 0, 0) rotateY(-90deg)`],
    ["D", `translate3d(0, ${half}px, 0) rotateX(-90deg)`],
    ["U", `translate3d(0, ${-half}px, 0) rotateX(90deg)`],
    ["F", `translate3d(0, 0, ${half}px)`],
    ["B", `translate3d(0, 0, ${-half}px) rotateY(180deg)`],
  ]
  for (const [face, transform] of faces) {
    const f = document.createElement("div")
    const visible = isVisibleSticker(face, home)
    Object.assign(f.style, {
      position: "absolute",
      width: `${CUBIE}px`,
      height: `${CUBIE}px`,
      transform,
      backfaceVisibility: "hidden",
      borderRadius: "8px",
      background: visible ? STICKER[face] : "#0a0a0a",
      boxShadow: visible
        ? "inset 0 0 0 3px #0a0a0a, inset 0 2px 0 rgba(255,255,255,0.18)"
        : "inset 0 0 0 2px #050505",
    })
    el.appendChild(f)
  }

  return { el, slot: [home[0], home[1], home[2]], rotation: ID3 }
}

function isVisibleSticker(face: Face, home: readonly [number, number, number]): boolean {
  const { axis, layer } = FACE_INFO[face]
  return home[axis] === layer
}

function writeTransform(c: Cubie, faceRot: Mat3): void {
  const r = mul(faceRot, c.rotation)
  const pos = applyV(faceRot, [c.slot[0] * STEP, c.slot[1] * STEP, c.slot[2] * STEP])
  c.el.style.transform = toCss(r, pos)
}

function cubiesOnFace(cubies: Cubie[], face: Face): Cubie[] {
  const { axis, layer } = FACE_INFO[face]
  return cubies.filter((c) => c.slot[axis] === layer)
}

// Animate a single quarter turn. Returns a handle whose `finished`
// resolves after the turn settles, plus a `commit` that bakes the
// rotation into the affected cubies' state.
function animateTurn(
  cubies: Cubie[],
  move: Move,
): { handle: ValuesHandle; commit: () => void; affected: Cubie[] } {
  const { axis, spinSign } = FACE_INFO[move.face]
  const targetDeg = 90 * move.dir * spinSign
  const affected = cubiesOnFace(cubies, move.face)

  const def = tween({ a: [0, targetDeg] }, { duration: MOVE_MS, easing: easeInOut })
  const handle = playValues(def, (v) => {
    const fr = rot(axis, (v.a * Math.PI) / 180)
    for (const c of affected) writeTransform(c, fr)
  })

  const commit = (): void => {
    const finalRot = rot(axis, (targetDeg * Math.PI) / 180)
    for (const c of affected) {
      c.rotation = mul(finalRot, c.rotation)
      const next = applyV(finalRot, c.slot)
      c.slot = [Math.round(next[0]), Math.round(next[1]), Math.round(next[2])] as [
        number,
        number,
        number,
      ]
      writeTransform(c, ID3)
    }
  }

  return { handle, commit, affected }
}

const FACES: readonly Face[] = ["U", "D", "L", "R", "F", "B"] as const

function randomScramble(n: number): Move[] {
  const moves: Move[] = []
  let prevFace: Face | null = null
  for (let i = 0; i < n; i++) {
    let f: Face
    do {
      f = FACES[Math.floor(Math.random() * FACES.length)]!
    } while (f === prevFace)
    prevFace = f
    moves.push({ face: f, dir: Math.random() < 0.5 ? 1 : -1 })
  }
  return moves
}

// --- cubejs facelet string extraction ---
//
// cubejs accepts cube state as a 54-char URFDLB facelet string. Per face
// (read row-major as if looking at it from outside, with U on top): U,
// then R, F, D, L, B. Each character is the letter of the colour at
// that sticker (U/R/F/D/L/B). Centers are fixed so they're trivially
// the face letter; everything else needs a lookup against the live
// cubie state.

function findCubie(cubies: Cubie[], slot: readonly [number, number, number]): Cubie | undefined {
  return cubies.find((c) => c.slot[0] === slot[0] && c.slot[1] === slot[1] && c.slot[2] === slot[2])
}

function localDirToFace(d: readonly [number, number, number]): Face {
  // Each cubie's local axes point at one of the six faces. After turns,
  // the dominant component of d (in local frame) tells us which.
  const ax = Math.abs(d[0])
  const ay = Math.abs(d[1])
  const az = Math.abs(d[2])
  if (ax >= ay && ax >= az) return d[0] > 0 ? "R" : "L"
  if (ay >= az) return d[1] > 0 ? "D" : "U"
  return d[2] > 0 ? "F" : "B"
}

// World-space slot positions for each sticker, in URFDLB order. For a
// given face, the 9 entries are read row-major as if looking at the
// face from outside with U at the top of the view (and F in the front
// for U/D faces). The companion world-direction is the outward normal
// of the face we're sampling.
const STICKER_LAYOUT: ReadonlyArray<{
  face: Face
  worldDir: readonly [number, number, number]
  positions: ReadonlyArray<readonly [number, number, number]>
}> = [
  {
    face: "U",
    worldDir: [0, -1, 0],
    positions: [
      [-1, -1, -1],
      [0, -1, -1],
      [1, -1, -1],
      [-1, -1, 0],
      [0, -1, 0],
      [1, -1, 0],
      [-1, -1, 1],
      [0, -1, 1],
      [1, -1, 1],
    ],
  },
  {
    face: "R",
    worldDir: [1, 0, 0],
    positions: [
      [1, -1, 1],
      [1, -1, 0],
      [1, -1, -1],
      [1, 0, 1],
      [1, 0, 0],
      [1, 0, -1],
      [1, 1, 1],
      [1, 1, 0],
      [1, 1, -1],
    ],
  },
  {
    face: "F",
    worldDir: [0, 0, 1],
    positions: [
      [-1, -1, 1],
      [0, -1, 1],
      [1, -1, 1],
      [-1, 0, 1],
      [0, 0, 1],
      [1, 0, 1],
      [-1, 1, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
  },
  {
    face: "D",
    worldDir: [0, 1, 0],
    positions: [
      [-1, 1, 1],
      [0, 1, 1],
      [1, 1, 1],
      [-1, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
      [-1, 1, -1],
      [0, 1, -1],
      [1, 1, -1],
    ],
  },
  {
    face: "L",
    worldDir: [-1, 0, 0],
    positions: [
      [-1, -1, -1],
      [-1, -1, 0],
      [-1, -1, 1],
      [-1, 0, -1],
      [-1, 0, 0],
      [-1, 0, 1],
      [-1, 1, -1],
      [-1, 1, 0],
      [-1, 1, 1],
    ],
  },
  {
    face: "B",
    worldDir: [0, 0, -1],
    positions: [
      [1, -1, -1],
      [0, -1, -1],
      [-1, -1, -1],
      [1, 0, -1],
      [0, 0, -1],
      [-1, 0, -1],
      [1, 1, -1],
      [0, 1, -1],
      [-1, 1, -1],
    ],
  },
]

function extractFaceletString(cubies: Cubie[]): string {
  let out = ""
  for (const { face, worldDir, positions } of STICKER_LAYOUT) {
    for (const slot of positions) {
      const cubie = findCubie(cubies, slot)
      if (!cubie) {
        out += face
        continue
      }
      const localDir = applyVT(cubie.rotation, worldDir)
      out += localDirToFace(localDir)
    }
  }
  return out
}

function isSolvedFacelets(s: string): boolean {
  for (let i = 0; i < 6; i++) {
    const head = s[i * 9]
    for (let j = 1; j < 9; j++) if (s[i * 9 + j] !== head) return false
  }
  return true
}

function parseSolution(solution: string): Move[] {
  const moves: Move[] = []
  for (const tok of solution.trim().split(/\s+/)) {
    if (tok === "") continue
    const face = tok[0] as Face
    if (!"URFDLB".includes(face)) continue
    const suffix = tok.slice(1)
    if (suffix === "") moves.push({ face, dir: 1 })
    else if (suffix === "'") moves.push({ face, dir: -1 })
    else if (suffix === "2") {
      moves.push({ face, dir: 1 })
      moves.push({ face, dir: 1 })
    }
  }
  return moves
}

// Init the Kociemba two-phase solver tables. This freezes the main
// thread for ~5s the first time it runs; subsequent calls are no-ops
// because cubejs caches the tables on the module.
let solverInitPromise: Promise<void> | null = null
function ensureSolver(onStart?: () => void): Promise<void> {
  if (solverInitPromise) return solverInitPromise
  solverInitPromise = new Promise<void>((resolve) => {
    onStart?.()
    // setTimeout so the browser paints the "loading" status before we
    // block. requestIdleCallback would be nicer but isn't available in
    // Safari; the small delay here is plenty.
    setTimeout(() => {
      Cube.initSolver()
      resolve()
    }, 60)
  })
  return solverInitPromise
}

export const rubiksCube: Demo = {
  id: "rubiks-cube",
  title: "Rubik's cube · scramble & solve",
  blurb:
    "A 3D cube driven entirely by `@kinem/core`. Each face turn is a `tween` on the rotation angle that's broadcast to the 9 affected cubies via `playValues`; the cube's full state is also tracked in JS so we can extract a 54-char facelet string. Press Solve to hand that string to cubejs's two-phase Kociemba solver and queue every returned move through the same animation pipeline. Drag to orbit.",
  group: "Stagger & cascade",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      background:
        "radial-gradient(ellipse at 50% 35%, #1a1a2e 0%, #06060c 70%), radial-gradient(ellipse at 80% 80%, #1d2247 0%, transparent 60%)",
      display: "grid",
      placeItems: "center",
      perspective: "1400px",
      overflow: "hidden",
      cursor: "grab",
      userSelect: "none",
    })
    stage.appendChild(wrap)

    const scene = document.createElement("div")
    Object.assign(scene.style, {
      position: "relative",
      width: "0",
      height: "0",
      transformStyle: "preserve-3d",
    })
    wrap.appendChild(scene)

    // The cube parent gets the orbit transform.
    const cube = document.createElement("div")
    Object.assign(cube.style, {
      position: "absolute",
      transformStyle: "preserve-3d",
      willChange: "transform",
    })
    scene.appendChild(cube)

    const cubies: Cubie[] = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Skip the invisible center cubie. It costs nothing to render
          // but conceptually it's not a piece of the puzzle.
          if (x === 0 && y === 0 && z === 0) continue
          const c = buildCubie([x, y, z])
          writeTransform(c, ID3)
          cube.appendChild(c.el)
          cubies.push(c)
        }
      }
    }

    // Camera orbit. Drag yaw/pitch on pointermove, no inertia.
    let yaw = -32 // deg
    let pitch = -22
    const applyCamera = (): void => {
      cube.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`
    }
    applyCamera()

    let dragging: { x: number; y: number; yaw0: number; pitch0: number } | null = null
    const onDown = (e: PointerEvent): void => {
      // Don't start an orbit drag when the user is hitting a control
      // button at the bottom of the stage.
      if ((e.target as HTMLElement).closest(".rubik-controls")) return
      dragging = { x: e.clientX, y: e.clientY, yaw0: yaw, pitch0: pitch }
      wrap.style.cursor = "grabbing"
      wrap.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return
      yaw = dragging.yaw0 + (e.clientX - dragging.x) * 0.4
      pitch = Math.max(-80, Math.min(80, dragging.pitch0 - (e.clientY - dragging.y) * 0.4))
      applyCamera()
    }
    const onUp = (e: PointerEvent): void => {
      if (!dragging) return
      dragging = null
      wrap.style.cursor = "grab"
      wrap.releasePointerCapture(e.pointerId)
    }
    wrap.addEventListener("pointerdown", onDown)
    wrap.addEventListener("pointermove", onMove)
    wrap.addEventListener("pointerup", onUp)
    wrap.addEventListener("pointercancel", onUp)

    // Move queue + state machine.
    let queue: Move[] = []
    let activeHandle: ValuesHandle | null = null
    let isPlaying = false
    let cancelRequested = false

    const status = document.createElement("div")
    Object.assign(status.style, {
      position: "absolute",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(232,236,244,0.7)",
      fontSize: "12px",
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      fontWeight: "600",
      pointerEvents: "none",
    })
    status.textContent = "ready"
    wrap.appendChild(status)

    const setStatus = (s: string): void => {
      status.textContent = s
    }

    const playQueue = async (label: string): Promise<void> => {
      if (isPlaying) return
      isPlaying = true
      cancelRequested = false
      let i = 0
      const total = queue.length
      while (queue.length > 0 && !cancelRequested) {
        const m = queue.shift()!
        i++
        setStatus(`${label} · ${i}/${total} · ${m.face}${m.dir < 0 ? "'" : ""}`)
        const turn = animateTurn(cubies, m)
        activeHandle = turn.handle
        try {
          await turn.handle.finished
        } catch {
          // Handle was cancelled mid-flight. Drop the in-flight visual
          // state by snapping the affected cubies to their pre-turn
          // transform; we never committed, so their slots / matrices
          // still describe the pre-turn position.
          for (const c of turn.affected) writeTransform(c, ID3)
          break
        }
        turn.commit()
        activeHandle = null
      }
      isPlaying = false
      activeHandle = null
      if (cancelRequested) {
        setStatus("cancelled")
      } else {
        setStatus("done")
      }
    }

    const cancel = (): void => {
      cancelRequested = true
      activeHandle?.cancel()
      queue.length = 0
    }

    // Controls bar.
    const bar = document.createElement("div")
    bar.className = "rubik-controls"
    Object.assign(bar.style, {
      position: "absolute",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "8px",
      padding: "8px",
      background: "rgba(8,10,18,0.8)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      backdropFilter: "blur(8px)",
    })
    wrap.appendChild(bar)

    const mkButton = (label: string, onClick: () => void): HTMLButtonElement => {
      const btn = document.createElement("button")
      btn.textContent = label
      Object.assign(btn.style, {
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: "600",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#e8ecf4",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        cursor: "pointer",
      })
      btn.addEventListener("click", onClick)
      return btn
    }

    const doScramble = async (): Promise<void> => {
      if (isPlaying) return
      queue = randomScramble(20)
      await playQueue("scramble")
    }
    const doSolve = async (): Promise<void> => {
      if (isPlaying) return
      const facelets = extractFaceletString(cubies)
      if (isSolvedFacelets(facelets)) {
        setStatus("already solved")
        return
      }
      await ensureSolver(() => setStatus("loading solver…"))
      let solution: string
      try {
        solution = Cube.fromString(facelets).solve()
      } catch (err) {
        setStatus("solver error")
        // eslint-disable-next-line no-console
        console.error("cubejs solver error", err, facelets)
        return
      }
      queue = parseSolution(solution)
      if (queue.length === 0) {
        setStatus("already solved")
        return
      }
      await playQueue("solve")
    }
    const doStop = (): void => {
      cancel()
    }

    bar.appendChild(mkButton("Scramble", doScramble))
    bar.appendChild(mkButton("Solve", doSolve))
    bar.appendChild(mkButton("Stop", doStop))

    // Auto-scramble shortly after mount so the demo isn't a static
    // grid on first load. After the scramble settles, kick off the
    // solver init in the background so the first Solve press is
    // instant; while initSolver runs it blocks the main thread, but
    // by then the cube is sitting still anyway.
    let initId: number | null = null
    const autoId = window.setTimeout(() => {
      void doScramble().then(() => {
        initId = window.setTimeout(() => {
          void ensureSolver(() => setStatus("warming solver…")).then(() => {
            setStatus("ready")
          })
        }, 400)
      })
    }, 600)

    return () => {
      window.clearTimeout(autoId)
      if (initId !== null) window.clearTimeout(initId)
      cancel()
      wrap.removeEventListener("pointerdown", onDown)
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerup", onUp)
      wrap.removeEventListener("pointercancel", onUp)
    }
  },
}
