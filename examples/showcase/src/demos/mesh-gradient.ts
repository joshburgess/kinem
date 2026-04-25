import { float, playUniforms, spring, vec2, vec3 } from "@kinem/core"
import type { Demo } from "../demo"

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform vec2 uMouse;
uniform vec3 uPaletteA[5];
uniform vec3 uPaletteB[5];
uniform float uMix;
out vec4 outColor;

vec2 lissajous(float t, vec2 amp, vec2 freq, vec2 phase) {
  return vec2(
    0.5 + amp.x * sin(t * freq.x + phase.x),
    0.5 + amp.y * sin(t * freq.y + phase.y)
  );
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  float t = uTime * 0.18;

  vec2 p0 = lissajous(t, vec2(0.40, 0.30), vec2(0.7, 0.9), vec2(0.0, 1.2));
  vec2 p1 = lissajous(t, vec2(0.35, 0.40), vec2(1.1, 0.6), vec2(2.1, 0.4));
  vec2 p2 = lissajous(t, vec2(0.45, 0.35), vec2(0.5, 1.3), vec2(4.3, 2.7));
  vec2 p3 = lissajous(t, vec2(0.30, 0.45), vec2(1.4, 0.8), vec2(3.7, 5.1));
  p0.x *= uAspect; p1.x *= uAspect; p2.x *= uAspect; p3.x *= uAspect;
  vec2 p4 = vec2(uMouse.x * uAspect, uMouse.y);

  vec3 col = vec3(0.0);
  float wsum = 0.0;
  vec2 pts[5];
  pts[0] = p0; pts[1] = p1; pts[2] = p2; pts[3] = p3; pts[4] = p4;

  for (int i = 0; i < 5; i++) {
    vec3 c = mix(uPaletteA[i], uPaletteB[i], uMix);
    float d = distance(uv, pts[i]);
    float w = 1.0 / (d * d * 6.0 + 0.04);
    col += c * w;
    wsum += w;
  }
  col /= wsum;

  // Subtle film grain
  float grain = fract(sin(dot(vUv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.015;

  outColor = vec4(col, 1.0);
}
`

const PALETTES: ReadonlyArray<readonly [number, number, number][]> = [
  // Sunrise
  [
    [0.95, 0.45, 0.7],
    [0.45, 0.55, 0.95],
    [1.0, 0.7, 0.4],
    [0.5, 0.35, 0.9],
    [1.0, 0.95, 0.7],
  ],
  // Aurora
  [
    [0.2, 0.95, 0.75],
    [0.4, 0.6, 1.0],
    [0.85, 0.55, 1.0],
    [0.15, 0.35, 0.7],
    [0.7, 1.0, 0.95],
  ],
  // Ember
  [
    [1.0, 0.4, 0.25],
    [0.9, 0.2, 0.55],
    [1.0, 0.75, 0.3],
    [0.55, 0.15, 0.4],
    [1.0, 0.95, 0.6],
  ],
  // Deep sea
  [
    [0.15, 0.3, 0.8],
    [0.35, 0.85, 0.95],
    [0.45, 0.25, 0.95],
    [0.1, 0.6, 0.85],
    [0.85, 0.95, 1.0],
  ],
] as const

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)
  if (!s) throw new Error("createShader failed")
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed")
  }
  return s
}

export const meshGradient: Demo = {
  id: "mesh-gradient",
  title: "Animated mesh gradient",
  blurb:
    "Five colored points blend over a Lissajous orbit. One tracks your cursor with kinem spring physics. Click to morph palettes.",
  group: "Showcase",
  mount(stage) {
    const canvas = document.createElement("canvas")
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      cursor: "pointer",
    })
    stage.appendChild(canvas)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = (): void => {
      canvas.width = stage.clientWidth * dpr
      canvas.height = stage.clientHeight * dpr
    }
    resize()

    const gl = canvas.getContext("webgl2")
    if (!gl) {
      stage.innerHTML = '<pre style="color:#f87171;padding:24px">WebGL2 not available</pre>'
      return () => {}
    }

    const prog = gl.createProgram()
    if (!prog) return () => {}
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed")
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uTimeLoc = gl.getUniformLocation(prog, "uTime")
    const uAspectLoc = gl.getUniformLocation(prog, "uAspect")
    const uMouseLoc = gl.getUniformLocation(prog, "uMouse")
    const uMixLoc = gl.getUniformLocation(prog, "uMix")
    const paletteALocs: (WebGLUniformLocation | null)[] = []
    const paletteBLocs: (WebGLUniformLocation | null)[] = []
    for (let i = 0; i < 5; i++) {
      paletteALocs.push(gl.getUniformLocation(prog, `uPaletteA[${i}]`))
      paletteBLocs.push(gl.getUniformLocation(prog, `uPaletteB[${i}]`))
    }

    const writePalette = (
      locs: (WebGLUniformLocation | null)[],
      pal: ReadonlyArray<readonly [number, number, number]>,
    ): void => {
      for (let i = 0; i < 5; i++) {
        const loc = locs[i] ?? null
        const c = pal[i]
        if (!c) continue
        gl.uniform3fv(loc, c)
      }
    }

    let paletteIdx = 0
    writePalette(paletteALocs, PALETTES[0]!)
    writePalette(paletteBLocs, PALETTES[1]!)
    gl.uniform1f(uMixLoc, 0)

    let aspect = canvas.width / canvas.height
    gl.uniform1f(uAspectLoc, aspect)
    gl.uniform2fv(uMouseLoc, [0.5, 0.5])

    const render = (): void => {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const start = performance.now()
    let timeRafId = 0
    const tick = (): void => {
      const t = (performance.now() - start) / 1000
      gl.uniform1f(uTimeLoc, t)
      render()
      timeRafId = requestAnimationFrame(tick)
    }
    timeRafId = requestAnimationFrame(tick)

    // Mouse-tracking 5th control point, smoothed with kinem spring
    let mouseX = 0.5
    let mouseY = 0.5
    let activeMouseHandle: ReturnType<typeof playUniforms> | null = null
    const driveMouse = (toX: number, toY: number): void => {
      activeMouseHandle?.cancel()
      activeMouseHandle = playUniforms(
        spring(
          {
            uMouse: [
              [mouseX, mouseY],
              [toX, toY],
            ],
          },
          { stiffness: 90, damping: 16 },
        ),
        gl,
        { uMouse: vec2(uMouseLoc) },
      )
    }
    // Track current mouse to keep state in sync (kinem doesn't expose interpolated value)
    const onPointerMove = (e: PointerEvent): void => {
      const r = canvas.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = 1 - (e.clientY - r.top) / r.height
      mouseX = x
      mouseY = y
      driveMouse(x, y)
    }
    const onPointerLeave = (): void => {
      driveMouse(0.5, 0.5)
      mouseX = 0.5
      mouseY = 0.5
    }
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerleave", onPointerLeave)

    // Click to morph palettes (kinem-driven crossfade)
    let activeMixHandle: ReturnType<typeof playUniforms> | null = null
    const morph = (): void => {
      activeMixHandle?.cancel()
      const next = (paletteIdx + 1) % PALETTES.length
      writePalette(paletteALocs, PALETTES[paletteIdx]!)
      writePalette(paletteBLocs, PALETTES[next]!)
      gl.uniform1f(uMixLoc, 0)
      activeMixHandle = playUniforms(spring({ uMix: [0, 1] }, { stiffness: 60, damping: 20 }), gl, {
        uMix: float(uMixLoc),
      })
      paletteIdx = next
    }
    canvas.addEventListener("pointerdown", morph)

    const onResize = (): void => {
      resize()
      aspect = canvas.width / canvas.height
      gl.uniform1f(uAspectLoc, aspect)
    }
    window.addEventListener("resize", onResize)

    // Suppress unused-import warning for vec3 — still used for documentation
    void vec3

    return () => {
      cancelAnimationFrame(timeRafId)
      activeMouseHandle?.cancel()
      activeMixHandle?.cancel()
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      canvas.removeEventListener("pointerdown", morph)
      window.removeEventListener("resize", onResize)
    }
  },
}
