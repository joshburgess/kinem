/**
 * Generate placeholder icon PNGs for the extension. Nothing fancy:
 * solid kinem-blue square with a centered "K" glyph carved out, at
 * 16 / 48 / 128. Runs only when an icon is missing, so contributors
 * can drop hand-drawn art in `icons/` and the build leaves them
 * alone.
 */

import { mkdir, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync } from "node:zlib"

const __filename = fileURLToPath(import.meta.url)
const root = resolve(dirname(__filename), "..")
const iconsDir = join(root, "icons")

const BG = [124, 156, 255, 255] // #7c9cff
const FG = [20, 20, 30, 255] // near-black

// The letter K, rendered from a tiny 5x7 bitmap, scaled up by repeat.
const GLYPH = ["1...1", "1..1.", "1.1..", "11...", "1.1..", "1..1.", "1...1"]

function buildRGBA(size) {
  const data = Buffer.alloc(size * size * 4)
  const pad = Math.floor(size / 5)
  const inner = size - pad * 2
  const cellW = Math.floor(inner / 5)
  const cellH = Math.floor(inner / 7)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      let color = BG
      const gx = Math.floor((x - pad) / cellW)
      const gy = Math.floor((y - pad) / cellH)
      if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7) {
        if (GLYPH[gy][gx] === "1") color = FG
      }
      data[i] = color[0]
      data[i + 1] = color[1]
      data[i + 2] = color[2]
      data[i + 3] = color[3]
    }
  }
  return data
}

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, "ascii")
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(size) {
  const rgba = buildRGBA(size)
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter byte: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const idat = deflateSync(raw)
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(iconsDir, { recursive: true })
  for (const size of [16, 48, 128]) {
    const p = join(iconsDir, `icon${size}.png`)
    if (await exists(p)) continue
    await writeFile(p, encodePNG(size))
    console.log("wrote", p)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
