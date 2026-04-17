import type { EasingFn } from "./types"

export const linear: EasingFn = (p) => p

export const easeIn: EasingFn = (p) => p * p
export const easeOut: EasingFn = (p) => 1 - (1 - p) * (1 - p)
export const easeInOut: EasingFn = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/**
 * CSS cubic-bezier easing. Uses Newton-Raphson to invert x(t) = x, then
 * returns y(t). Matches the algorithm used by browsers for CSS transitions.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const ax = 3 * x1 - 3 * x2 + 1
  const bx = 3 * x2 - 6 * x1
  const cx = 3 * x1

  const ay = 3 * y1 - 3 * y2 + 1
  const by = 3 * y2 - 6 * y1
  const cy = 3 * y1

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const sampleDerivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const SAMPLES = 11
  const STEP = 1 / (SAMPLES - 1)
  const table = new Float64Array(SAMPLES)
  for (let i = 0; i < SAMPLES; i++) table[i] = sampleX(i * STEP)

  const solve = (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1

    let i = 1
    while (i < SAMPLES - 1 && (table[i] ?? 0) < x) i++
    const prev = table[i - 1] ?? 0
    const curr = table[i] ?? 1
    const guessT = (i - 1 + (x - prev) / (curr - prev)) * STEP

    let t = guessT
    for (let j = 0; j < 8; j++) {
      const d = sampleDerivX(t)
      if (d === 0) break
      const xt = sampleX(t) - x
      t -= xt / d
    }
    return t
  }

  return (p) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    return sampleY(solve(p))
  }
}

export type StepPosition = "start" | "end" | "jump-none" | "jump-both"

/**
 * CSS steps() easing. n must be >= 1. Position matches CSS semantics:
 *   - "end" (default): steps on the trailing edge
 *   - "start": steps on the leading edge
 *   - "jump-none": n - 1 jumps, start at 0 and end at 1
 *   - "jump-both": n + 1 jumps, start above 0 and end below 1
 */
export function steps(n: number, position: StepPosition = "end"): EasingFn {
  if (n < 1) throw new RangeError("steps(n): n must be >= 1")
  return (p) => {
    if (p <= 0) return position === "start" || position === "jump-both" ? 1 / n : 0
    if (p >= 1) return position === "end" || position === "jump-both" ? 1 - 1 / n : 1

    switch (position) {
      case "start":
        return Math.min(1, (Math.floor(p * n) + 1) / n)
      case "end":
        return Math.floor(p * n) / n
      case "jump-none":
        return n === 1 ? 0 : Math.floor(p * n) / (n - 1)
      case "jump-both":
        return (Math.floor(p * n) + 1) / (n + 1)
    }
  }
}

export interface SpringOpts {
  readonly stiffness?: number
  readonly damping?: number
  readonly mass?: number
  readonly velocity?: number
  readonly restVelocity?: number
  readonly restDisplacement?: number
  readonly maxDuration?: number
}

/**
 * A spring easing carries its computed settling duration alongside the
 * easing function. Tween constructors check for the `duration` property to
 * infer the spring's duration when the user doesn't specify one.
 */
export type SpringEasingFn = EasingFn & { readonly duration: number }

export const isSpringEasing = (fn: EasingFn): fn is SpringEasingFn =>
  typeof (fn as Partial<SpringEasingFn>).duration === "number"

const DEFAULT_SPRING: Required<SpringOpts> = {
  stiffness: 170,
  damping: 26,
  mass: 1,
  velocity: 0,
  restVelocity: 0.001,
  restDisplacement: 0.001,
  maxDuration: 10_000,
}

/**
 * Spring physics easing. Simulates m*x'' + c*x' + k*(x - 1) = 0 with RK4
 * integration, starting from x = 0 and running until velocity and
 * displacement stay within rest thresholds. The resulting trajectory is
 * stored as a lookup table; the returned easing function maps progress
 * [0, 1] to position along that trajectory.
 *
 * The computed settling time is attached as `.duration` (ms).
 */
export function springEasing(opts: SpringOpts = {}): SpringEasingFn {
  const { stiffness, damping, mass, velocity, restVelocity, restDisplacement, maxDuration } = {
    ...DEFAULT_SPRING,
    ...opts,
  }
  const dt = 1 / 60
  const dtMs = dt * 1000
  const maxSteps = Math.ceil(maxDuration / dtMs)

  const accel = (x: number, v: number) => (-stiffness * (x - 1) - damping * v) / mass

  const samples: number[] = [0]
  let x = 0
  let v = velocity
  let restCount = 0
  const REST_FRAMES = 4

  for (let step = 0; step < maxSteps; step++) {
    const k1x = v
    const k1v = accel(x, v)
    const k2x = v + (dt / 2) * k1v
    const k2v = accel(x + (dt / 2) * k1x, v + (dt / 2) * k1v)
    const k3x = v + (dt / 2) * k2v
    const k3v = accel(x + (dt / 2) * k2x, v + (dt / 2) * k2v)
    const k4x = v + dt * k3v
    const k4v = accel(x + dt * k3x, v + dt * k3v)

    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x)
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)

    samples.push(x)

    if (Math.abs(v) < restVelocity && Math.abs(x - 1) < restDisplacement) {
      restCount++
      if (restCount >= REST_FRAMES) break
    } else {
      restCount = 0
    }
  }

  const lastIdx = samples.length - 1
  samples[lastIdx] = 1
  const duration = lastIdx * dtMs

  const fn = ((p: number): number => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    const exact = p * lastIdx
    const i = Math.floor(exact)
    const frac = exact - i
    const a = samples[i] ?? 0
    const b = samples[i + 1] ?? 1
    return a + (b - a) * frac
  }) as SpringEasingFn
  Object.defineProperty(fn, "duration", { value: duration, enumerable: true })
  return fn
}
