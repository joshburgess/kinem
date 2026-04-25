import { easeInOut, float, playUniforms, tween } from "@kinem/core"
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
uniform float uProgress;
uniform float uTime;
out vec4 outColor;

// Cheap 2D hash noise
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

vec3 paletteA(vec2 uv, float t) {
  float n = fbm(uv * 3.0 + vec2(t * 0.05, 0.0));
  vec3 c1 = vec3(0.05, 0.10, 0.30);
  vec3 c2 = vec3(0.80, 0.35, 0.95);
  vec3 c3 = vec3(0.98, 0.62, 0.30);
  vec3 col = mix(c1, c2, smoothstep(0.2, 0.6, n));
  col = mix(col, c3, smoothstep(0.55, 0.85, n));
  return col;
}

vec3 paletteB(vec2 uv, float t) {
  float n = fbm(uv * 4.0 + vec2(-t * 0.04, t * 0.02));
  vec3 c1 = vec3(0.02, 0.25, 0.30);
  vec3 c2 = vec3(0.20, 0.85, 0.70);
  vec3 c3 = vec3(0.95, 0.95, 0.75);
  vec3 col = mix(c1, c2, smoothstep(0.25, 0.65, n));
  col = mix(col, c3, smoothstep(0.6, 0.9, n));
  return col;
}

void main() {
  vec2 uv = vUv;
  float n = fbm(uv * 2.5);
  // Displacement-driven reveal mask
  float mask = smoothstep(uProgress - 0.2, uProgress + 0.2, n);
  vec3 a = paletteA(uv, uTime);
  vec3 b = paletteB(uv, uTime);
  vec3 col = mix(a, b, mask);

  // Edge glow at the transition
  float edge = 1.0 - smoothstep(0.0, 0.08, abs(n - uProgress));
  col += edge * vec3(0.8, 0.6, 1.0) * 0.6;

  outColor = vec4(col, 1.0);
}
`

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

export const shaderReveal: Demo = {
  id: "shader-reveal",
  title: "Liquid shader reveal",
  blurb:
    "Hover the scene. A WebGL fragment shader morphs between two palettes using FBM noise — the uProgress uniform is driven by kinem's playUniforms.",
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

    const uProgressLoc = gl.getUniformLocation(prog, "uProgress")
    const uTimeLoc = gl.getUniformLocation(prog, "uTime")

    const render = (): void => {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    let lastProgress = 0
    const glLike = {
      uniform1f(l: WebGLUniformLocation | null, v: number) {
        gl.uniform1f(l, v)
        if (l === uProgressLoc) {
          lastProgress = v
        }
        render()
      },
      uniform2fv() {},
      uniform3fv() {},
      uniform4fv() {},
      uniformMatrix4fv() {},
    }

    // Continuous time driver
    const start = performance.now()
    let timeRafId = 0
    const tickTime = (): void => {
      const t = (performance.now() - start) / 1000
      gl.uniform1f(uTimeLoc, t)
      render()
      timeRafId = requestAnimationFrame(tickTime)
    }
    timeRafId = requestAnimationFrame(tickTime)

    let currentHandle: ReturnType<typeof playUniforms> | null = null
    const animateTo = (target: number): void => {
      currentHandle?.cancel()
      currentHandle = playUniforms(
        tween({ uProgress: [lastProgress, target] }, { duration: 1400, easing: easeInOut }),
        glLike,
        { uProgress: float(uProgressLoc) },
      )
    }

    // Initial: progress 0
    gl.uniform1f(uProgressLoc, 0)
    render()

    const onEnter = (): void => animateTo(1)
    const onLeave = (): void => animateTo(0)
    canvas.addEventListener("pointerenter", onEnter)
    canvas.addEventListener("pointerleave", onLeave)

    const onResize = (): void => {
      resize()
      render()
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(timeRafId)
      currentHandle?.cancel()
      canvas.removeEventListener("pointerenter", onEnter)
      canvas.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("resize", onResize)
    }
  },
}
