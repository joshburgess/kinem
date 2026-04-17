/**
 * Color interpolation in OKLCH space.
 *
 * Parses sRGB colors (hex, rgb(), hsl()) and oklch() values, converts to
 * OKLCH for perceptually uniform interpolation, and renders back in the
 * target's original format. Hue interpolation follows the shortest arc.
 */

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch"

interface OklchColor {
  L: number
  C: number
  H: number
  alpha: number
}

export function isColor(value: string): boolean {
  const s = value.trim()
  if (s.startsWith("#")) return /^#[0-9a-fA-F]{3,8}$/.test(s)
  return /^(rgb|rgba|hsl|hsla|oklch)\s*\(/.test(s)
}

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function srgbToOklch(r: number, g: number, b: number, alpha: number): OklchColor {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]
  const [L, aa, bb] = linearSrgbToOklab(lr, lg, lb)
  const C = Math.sqrt(aa * aa + bb * bb)
  let H = (Math.atan2(bb, aa) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H, alpha }
}

function oklchToSrgb(c: OklchColor): [number, number, number, number] {
  const hr = (c.H * Math.PI) / 180
  const a = c.C * Math.cos(hr)
  const b = c.C * Math.sin(hr)
  const [lr, lg, lb] = oklabToLinearSrgb(c.L, a, b)
  return [clamp01(linearToSrgb(lr)), clamp01(linearToSrgb(lg)), clamp01(linearToSrgb(lb)), c.alpha]
}

function parseHex(input: string): [number, number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3,8})$/.exec(input.trim())
  if (!m) return null
  const h = m[1] ?? ""
  let r: number
  let g: number
  let b: number
  let a = 1
  if (h.length === 3 || h.length === 4) {
    r = Number.parseInt(h[0]! + h[0]!, 16)
    g = Number.parseInt(h[1]! + h[1]!, 16)
    b = Number.parseInt(h[2]! + h[2]!, 16)
    if (h.length === 4) a = Number.parseInt(h[3]! + h[3]!, 16) / 255
  } else if (h.length === 6 || h.length === 8) {
    r = Number.parseInt(h.slice(0, 2), 16)
    g = Number.parseInt(h.slice(2, 4), 16)
    b = Number.parseInt(h.slice(4, 6), 16)
    if (h.length === 8) a = Number.parseInt(h.slice(6, 8), 16) / 255
  } else {
    return null
  }
  return [r / 255, g / 255, b / 255, a]
}

function parseNumberOrPercent(s: string, basis = 1): number {
  const str = s.trim()
  if (str.endsWith("%")) return (Number.parseFloat(str) / 100) * basis
  return Number.parseFloat(str)
}

function splitArgs(inside: string): string[] {
  const slash = inside.indexOf("/")
  const main = slash >= 0 ? inside.slice(0, slash) : inside
  const alpha = slash >= 0 ? inside.slice(slash + 1) : ""
  const parts = main
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (alpha.trim()) parts.push(alpha.trim())
  return parts
}

function parseRgbFn(input: string): [number, number, number, number] | null {
  const m = /^rgba?\s*\(([^)]*)\)\s*$/i.exec(input.trim())
  if (!m) return null
  const args = splitArgs(m[1] ?? "")
  if (args.length < 3) return null
  const r = parseNumberOrPercent(args[0] ?? "", 255) / 255
  const g = parseNumberOrPercent(args[1] ?? "", 255) / 255
  const b = parseNumberOrPercent(args[2] ?? "", 255) / 255
  const a = args.length >= 4 ? parseNumberOrPercent(args[3] ?? "1", 1) : 1
  return [r, g, b, a]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = light - c / 2
  return [r + m, g + m, b + m]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function parseHslFn(input: string): [number, number, number, number] | null {
  const m = /^hsla?\s*\(([^)]*)\)\s*$/i.exec(input.trim())
  if (!m) return null
  const args = splitArgs(m[1] ?? "")
  if (args.length < 3) return null
  const h = Number.parseFloat(args[0] ?? "0")
  const s = parseNumberOrPercent(args[1] ?? "0%", 100)
  const l = parseNumberOrPercent(args[2] ?? "0%", 100)
  const [r, g, b] = hslToRgb(h, s, l)
  const a = args.length >= 4 ? parseNumberOrPercent(args[3] ?? "1", 1) : 1
  return [r, g, b, a]
}

function parseOklchFn(input: string): OklchColor | null {
  const m = /^oklch\s*\(([^)]*)\)\s*$/i.exec(input.trim())
  if (!m) return null
  const args = splitArgs(m[1] ?? "")
  if (args.length < 3) return null
  const L = parseNumberOrPercent(args[0] ?? "0", 1)
  const C = Number.parseFloat(args[1] ?? "0")
  const H = Number.parseFloat(args[2] ?? "0")
  const alpha = args.length >= 4 ? parseNumberOrPercent(args[3] ?? "1", 1) : 1
  return { L, C, H, alpha }
}

function parseColor(input: string): { oklch: OklchColor; format: ColorFormat } {
  const trimmed = input.trim()
  if (trimmed.startsWith("#")) {
    const rgba = parseHex(trimmed)
    if (!rgba) throw new Error(`Cannot parse color: "${input}"`)
    return { oklch: srgbToOklch(rgba[0], rgba[1], rgba[2], rgba[3]), format: "hex" }
  }
  const lower = trimmed.toLowerCase()
  if (lower.startsWith("oklch")) {
    const c = parseOklchFn(trimmed)
    if (!c) throw new Error(`Cannot parse color: "${input}"`)
    return { oklch: c, format: "oklch" }
  }
  if (lower.startsWith("hsl")) {
    const rgba = parseHslFn(trimmed)
    if (!rgba) throw new Error(`Cannot parse color: "${input}"`)
    return { oklch: srgbToOklch(rgba[0], rgba[1], rgba[2], rgba[3]), format: "hsl" }
  }
  if (lower.startsWith("rgb")) {
    const rgba = parseRgbFn(trimmed)
    if (!rgba) throw new Error(`Cannot parse color: "${input}"`)
    return { oklch: srgbToOklch(rgba[0], rgba[1], rgba[2], rgba[3]), format: "rgb" }
  }
  throw new Error(`Cannot parse color: "${input}"`)
}

const toByte = (c: number): number => Math.round(clamp01(c) * 255)
const hex2 = (n: number): string => n.toString(16).padStart(2, "0")

function formatColor(c: OklchColor, format: ColorFormat): string {
  if (format === "oklch") {
    const L = +c.L.toFixed(4)
    const C = +c.C.toFixed(4)
    const H = +(((c.H % 360) + 360) % 360).toFixed(2)
    if (c.alpha >= 1) return `oklch(${L} ${C} ${H})`
    return `oklch(${L} ${C} ${H} / ${+c.alpha.toFixed(3)})`
  }
  const [r, g, b, a] = oklchToSrgb(c)
  if (format === "hex") {
    const base = `#${hex2(toByte(r))}${hex2(toByte(g))}${hex2(toByte(b))}`
    return a >= 1 ? base : `${base}${hex2(toByte(a))}`
  }
  if (format === "hsl") {
    const [h, s, l] = rgbToHsl(clamp01(r), clamp01(g), clamp01(b))
    const H = +h.toFixed(2)
    const S = +s.toFixed(2)
    const L = +l.toFixed(2)
    return a >= 1 ? `hsl(${H} ${S}% ${L}%)` : `hsl(${H} ${S}% ${L}% / ${+a.toFixed(3)})`
  }
  const R = toByte(r)
  const G = toByte(g)
  const B = toByte(b)
  return a >= 1 ? `rgb(${R} ${G} ${B})` : `rgb(${R} ${G} ${B} / ${+a.toFixed(3)})`
}

const shortestHueDelta = (from: number, to: number): number => {
  let d = to - from
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

/**
 * Interpolate between two color strings. Parses both sides, converts to
 * OKLCH, linearly interpolates L, C, and alpha, interpolates H via the
 * shortest arc, then renders in the format of `to`.
 */
export function interpolateColor(from: string, to: string): (progress: number) => string {
  const a = parseColor(from).oklch
  const { oklch: b, format } = parseColor(to)
  const dL = b.L - a.L
  const dC = b.C - a.C
  const dH = shortestHueDelta(a.H, b.H)
  const dA = b.alpha - a.alpha

  return (p) => {
    const mixed: OklchColor = {
      L: a.L + dL * p,
      C: a.C + dC * p,
      H: a.H + dH * p,
      alpha: a.alpha + dA * p,
    }
    return formatColor(mixed, format)
  }
}
