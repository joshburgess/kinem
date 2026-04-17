/**
 * SVG path interpolation.
 *
 * Parses path `d` strings into a normalized list of commands (each with a
 * type letter and its numeric parameters), then interpolates the params
 * pairwise when the structure matches. Paths with differing command
 * sequences throw; Flubber-style point insertion for structural mismatches
 * will be added in a later pass.
 */

export interface PathCommand {
  readonly type: string
  readonly params: readonly number[]
}

const PARAMS_PER: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
}

const CMD_RE = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi

export function parsePath(input: string): readonly PathCommand[] {
  const out: PathCommand[] = []
  const str = input.trim()
  if (str === "") return out
  let m: RegExpExecArray | null
  CMD_RE.lastIndex = 0
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop idiom
  while ((m = CMD_RE.exec(str)) !== null) {
    const type = (m[1] ?? "") as keyof typeof PARAMS_PER
    const body = (m[2] ?? "").trim()
    const paramsPer = PARAMS_PER[type.toUpperCase()] ?? 0

    if (paramsPer === 0) {
      out.push({ type, params: [] })
      continue
    }

    const nums = body
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map((s) => Number.parseFloat(s))

    if (nums.some(Number.isNaN)) {
      throw new Error(`Invalid numeric parameter in path command "${type}${body}"`)
    }

    if (nums.length % paramsPer !== 0) {
      throw new Error(`"${type}" expects multiples of ${paramsPer} parameters, got ${nums.length}`)
    }

    // Implicit repeats: an M followed by extra coord pairs is treated as M then L...
    // We preserve the explicit command letter for the first group and repeat the
    // same letter for subsequent groups (this matches parser output for comparison).
    for (let i = 0; i < nums.length; i += paramsPer) {
      out.push({ type, params: nums.slice(i, i + paramsPer) })
    }
  }
  return out
}

export function stringifyPath(cmds: readonly PathCommand[]): string {
  const parts: string[] = []
  for (const c of cmds) {
    if (c.params.length === 0) parts.push(c.type)
    else parts.push(`${c.type}${c.params.map((n) => +n.toFixed(4)).join(" ")}`)
  }
  return parts.join(" ")
}

export function interpolatePath(from: string, to: string): (progress: number) => string {
  const a = parsePath(from)
  const b = parsePath(to)
  if (a.length !== b.length) {
    throw new Error(`path structure mismatch: ${a.length} command(s) vs ${b.length} command(s)`)
  }

  const template: PathCommand[] = new Array(a.length)
  const deltas: number[][] = new Array(a.length)
  for (let i = 0; i < a.length; i++) {
    const ca = a[i] as PathCommand
    const cb = b[i] as PathCommand
    if (ca.type !== cb.type) {
      throw new Error(`path command mismatch at index ${i}: "${ca.type}" vs "${cb.type}"`)
    }
    if (ca.params.length !== cb.params.length) {
      throw new Error(`path command "${ca.type}" param count mismatch at index ${i}`)
    }

    const d = new Array<number>(ca.params.length)
    for (let j = 0; j < ca.params.length; j++) {
      d[j] = (cb.params[j] ?? 0) - (ca.params[j] ?? 0)
    }
    template[i] = ca
    deltas[i] = d
  }

  return (p) => {
    const out: PathCommand[] = new Array(template.length)
    for (let i = 0; i < template.length; i++) {
      const t = template[i] as PathCommand
      const d = deltas[i] as number[]
      const params = new Array<number>(t.params.length)
      for (let j = 0; j < t.params.length; j++) {
        params[j] = (t.params[j] ?? 0) + (d[j] ?? 0) * p
      }
      out[i] = { type: t.type, params }
    }
    return stringifyPath(out)
  }
}
