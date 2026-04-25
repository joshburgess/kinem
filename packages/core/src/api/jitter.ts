import type { AnimationDef } from "../core/types"

export interface JitterOpts {
  /** Maximum displacement magnitude. Defaults to 4. */
  readonly amplitude?: number
  /** Wobbles per unit progress. Defaults to 6. */
  readonly frequency?: number
  /** Deterministic seed; same seed = same jitter pattern. Defaults to 1. */
  readonly seed?: number
  /** Restrict jitter to these property names. Defaults to all numeric properties. */
  readonly only?: readonly string[]
}

const DEFAULT_AMP = 4
const DEFAULT_FREQ = 6
const NOISE_SAMPLES = 64

function makeNoise(seed: number): (t: number) => number {
  let s = seed | 0
  const rand = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return ((s >>> 0) / 0x100000000) * 2 - 1
  }
  const buf = new Array<number>(NOISE_SAMPLES + 1)
  for (let i = 0; i < NOISE_SAMPLES; i++) buf[i] = rand()
  buf[NOISE_SAMPLES] = buf[0] as number
  return (t) => {
    const x = (((t % 1) + 1) % 1) * NOISE_SAMPLES
    const i = Math.floor(x)
    const f = x - i
    const a = buf[i] as number
    const b = buf[i + 1] as number
    const sm = f * f * (3 - 2 * f)
    return a + (b - a) * sm
  }
}

/**
 * Wrap an `AnimationDef` and add smooth noise displacement to its
 * numeric outputs. Turns clean motion into hand-drawn-looking motion.
 *
 * ```ts
 * play(jitter(motionPath(d), { amplitude: 6, frequency: 8 }), el)
 * ```
 *
 * Object-shaped values (e.g. `{x, y}`) get independent noise channels
 * per key. Scalar values are jittered as a single channel. Pass
 * `only: ["x", "y"]` to restrict jitter to specific properties.
 */
export function jitter<T>(def: AnimationDef<T>, opts: JitterOpts = {}): AnimationDef<T> {
  const amp = opts.amplitude ?? DEFAULT_AMP
  const freq = opts.frequency ?? DEFAULT_FREQ
  const seed = opts.seed ?? 1
  const only = opts.only ? new Set(opts.only) : null

  const noises = new Map<string, (t: number) => number>()
  let nextSeed = seed
  const getNoise = (key: string): ((t: number) => number) => {
    let n = noises.get(key)
    if (!n) {
      n = makeNoise(nextSeed++)
      noises.set(key, n)
    }
    return n
  }

  const out: AnimationDef<T> = {
    duration: def.duration,
    easing: def.easing,
    interpolate: (p) => {
      const base = def.interpolate(p)
      if (base === null || base === undefined) return base
      if (typeof base === "number") {
        return (base + amp * getNoise("__scalar__")(p * freq)) as T
      }
      if (typeof base !== "object") return base
      const result: Record<string, unknown> = {}
      const obj = base as unknown as Record<string, unknown>
      for (const k in obj) {
        const v = obj[k]
        if (typeof v === "number" && (!only || only.has(k))) {
          result[k] = v + amp * getNoise(k)(p * freq)
        } else {
          result[k] = v
        }
      }
      return result as T
    },
  }
  if (def.properties !== undefined)
    (out as { properties?: readonly string[] }).properties = def.properties
  if (def.tierSplit !== undefined)
    (out as { tierSplit?: typeof def.tierSplit }).tierSplit = def.tierSplit
  return out
}
