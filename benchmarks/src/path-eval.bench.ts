import {
  arc,
  bezierPath,
  follow,
  inertia,
  jitter,
  morphPath,
  motionPath,
  scrub,
  svgPathLength,
  tween,
} from "@kinem/core"
import { bench, describe } from "vitest"

/**
 * Per-frame cost of the post-0.2.0 motion primitives. These all sit on
 * the user's hot path: a draggable card running `inertia`, a cursor
 * trail running `follow`, a logo gliding along `motionPath`, a `scrub`
 * driven from scroll, and so on. Construction usually amortizes (you
 * build once and play many frames), but the `interpolate(p)` call is
 * what runs at 60 fps and is what these benches mostly target.
 *
 * Add new benches here when adding a new primitive so we can see its
 * cost on its own and catch regressions in subsequent passes.
 */

describe("bezierPath: single cubic segment", () => {
  const def = bezierPath(
    [
      [0, 0],
      [50, -100],
      [150, -100],
      [200, 0],
    ],
    { duration: 1000 },
  )
  bench("build", () => {
    bezierPath(
      [
        [0, 0],
        [50, -100],
        [150, -100],
        [200, 0],
      ],
      { duration: 1000 },
    )
  })
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
})

describe("bezierPath: 8-segment chained cubics with rotation", () => {
  const points: [number, number][] = [[0, 0]]
  for (let i = 0; i < 8; i++) {
    const x0 = i * 100
    points.push([x0 + 25, -80], [x0 + 75, -80], [x0 + 100, 0])
  }
  const def = bezierPath(points, { duration: 1000, rotateAlongPath: true })
  bench("build", () => {
    bezierPath(points, { duration: 1000, rotateAlongPath: true })
  })
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
  bench("sweep 0..1 step 1/60", () => {
    for (let i = 0; i <= 60; i++) def.interpolate(i / 60)
  })
})

describe("motionPath: SVG d-string", () => {
  const d = "M 0 0 C 50 -100 150 -100 200 0 S 350 100 400 0 S 550 -100 600 0"
  const def = motionPath(d, { duration: 1000 })
  bench("parse + build", () => {
    motionPath(d, { duration: 1000 })
  })
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
  bench("svgPathLength", () => {
    svgPathLength(d)
  })
})

describe("arc: half-revolution", () => {
  const def = arc(0, 0, 100, 0, 180)
  bench("build", () => {
    arc(0, 0, 100, 0, 180)
  })
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
})

describe("morphPath: square -> diamond", () => {
  const def = morphPath("M 0 0 L 100 0 L 100 100 L 0 100 Z", "M 50 0 L 100 50 L 50 100 L 0 50 Z")
  bench("build", () => {
    morphPath("M 0 0 L 100 0 L 100 100 L 0 100 Z", "M 50 0 L 100 50 L 50 100 L 0 50 Z")
  })
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
})

describe("morphPath: cubic-curved (realistic)", () => {
  // Two curved blob shapes. Sampling these produces points with arbitrary
  // long-tail decimals which is the workload that exposes Number.toString
  // cost on the hot path. The square/diamond bench above lands on clean
  // integers and hides that cost.
  const a =
    "M 50 0 C 80 0 100 20 100 50 C 100 80 80 100 50 100 C 20 100 0 80 0 50 C 0 20 20 0 50 0 Z"
  const b = "M 30 10 C 75 5 95 30 90 60 C 85 90 55 95 25 85 C 5 75 5 35 30 10 Z"
  const def = morphPath(a, b)
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
})

describe("inertia: 2-property flick", () => {
  const def = inertia({ x: [0, 1500], y: [0, 800] })
  bench("build", () => {
    inertia({ x: [0, 1500], y: [0, 800] })
  })
  bench("interpolate(0.5)", () => {
    def.interpolate(0.5)
  })
})

describe("jitter wrapping a tween", () => {
  const wrapped = jitter(tween({ x: [0, 100], y: [0, 100] }, { duration: 1000 }), {
    amplitude: 4,
    frequency: 6,
  })
  bench("interpolate(0.5)", () => {
    wrapped.interpolate(0.5)
  })
})

describe("scrub: push-mode setProgress hot path", () => {
  // Stand-in target that mimics the surface applyValues touches.
  const target = {
    style: { setProperty(_n: string, _v: string): void {} },
    setAttribute(_n: string, _v: string): void {},
  }
  const def = motionPath("M 0 0 C 50 -100 150 -100 200 0", { duration: 1000 })
  const handle = scrub(def, [target as never])
  bench("setProgress(p) sweep 0..1 step 1/60", () => {
    for (let i = 0; i <= 60; i++) handle.setProgress(i / 60)
  })
})

describe("follow: 16-link chain step", () => {
  // We can't directly bench the internal tick(), but we can build the
  // handle and exercise setLeader + snapTo, which together touch the
  // same arrays that tick() reads from each frame. This is a proxy for
  // the per-frame overhead before any DOM commit.
  const targets = Array.from({ length: 16 }, () => ({
    style: { setProperty(_n: string, _v: string) {} },
  }))
  const noopRaf = (_cb: (t: number) => void): number => 0
  const noopCancel = (_id: number): void => {}
  const handle = follow(targets, { raf: noopRaf, cancelRaf: noopCancel })
  bench("setLeader + snapTo round-trip", () => {
    handle.setLeader(100, 100)
    handle.snapTo(0, 0)
  })
})
