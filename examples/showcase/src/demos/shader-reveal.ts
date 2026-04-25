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
uniform vec2 uMouse;
uniform float uPaletteIndex;
uniform vec2 uAspect;
out vec4 outColor;

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
    p *= 2.02;
    amp *= 0.5;
  }
  return v;
}

// Domain warping for liquid look (Inigo Quilez)
vec2 warp(vec2 uv, float t) {
  vec2 q = vec2(fbm(uv + vec2(0.0, t * 0.15)), fbm(uv + vec2(5.2, t * 0.12)));
  vec2 r = vec2(
    fbm(uv + 4.0 * q + vec2(1.7, 9.2) + t * 0.1),
    fbm(uv + 4.0 * q + vec2(8.3, 2.8) + t * 0.13)
  );
  return uv + r * 0.6;
}

vec3 palette(int i, float n) {
  if (i == 0) {
    vec3 c1 = vec3(0.05, 0.07, 0.30);
    vec3 c2 = vec3(0.85, 0.30, 0.95);
    vec3 c3 = vec3(0.98, 0.62, 0.30);
    vec3 col = mix(c1, c2, smoothstep(0.15, 0.6, n));
    return mix(col, c3, smoothstep(0.55, 0.9, n));
  } else if (i == 1) {
    vec3 c1 = vec3(0.02, 0.20, 0.30);
    vec3 c2 = vec3(0.10, 0.85, 0.75);
    vec3 c3 = vec3(0.95, 0.97, 0.70);
    vec3 col = mix(c1, c2, smoothstep(0.2, 0.65, n));
    return mix(col, c3, smoothstep(0.6, 0.92, n));
  } else if (i == 2) {
    vec3 c1 = vec3(0.20, 0.02, 0.10);
    vec3 c2 = vec3(0.95, 0.30, 0.40);
    vec3 c3 = vec3(1.00, 0.85, 0.45);
    vec3 col = mix(c1, c2, smoothstep(0.18, 0.6, n));
    return mix(col, c3, smoothstep(0.6, 0.9, n));
  } else {
    vec3 c1 = vec3(0.02, 0.04, 0.18);
    vec3 c2 = vec3(0.32, 0.40, 0.95);
    vec3 c3 = vec3(0.88, 0.92, 1.00);
    vec3 col = mix(c1, c2, smoothstep(0.2, 0.6, n));
    return mix(col, c3, smoothstep(0.6, 0.95, n));
  }
}

vec3 sampledPalette(vec2 uv, float t, float idx) {
  vec2 w = warp(uv * 2.4 + vec2(t * 0.05, t * 0.04), t);
  float n = fbm(w * 1.6);

  float fIdx = mod(idx, 4.0);
  int i0 = int(floor(fIdx));
  int i1 = (i0 + 1) - 4 * (i0 / 3);
  float fr = fract(fIdx);
  vec3 a = palette(i0, n);
  vec3 b = palette(i1, n);
  return mix(a, b, fr);
}

void main() {
  vec2 uv = vUv;
  // Aspect-corrected radial distance from cursor
  vec2 d = (uv - uMouse) * uAspect;
  float dist = length(d);

  // Reveal mask with FBM displacement at the boundary -> liquid edge
  vec2 wuv = warp(uv * 3.0 + uTime * 0.04, uTime * 0.5);
  float disp = fbm(wuv * 1.4) * 0.45;
  // progress 0 -> contracted to cursor; progress 1 -> fully revealed
  float radius = uProgress * 0.4;
  float edge = dist - disp - radius;
  float mask = 1.0 - smoothstep(-0.06, 0.06, edge);

  vec3 base = sampledPalette(uv, uTime, uPaletteIndex);
  vec3 top = sampledPalette(uv, uTime + 11.0, uPaletteIndex + 1.0);
  vec3 col = mix(base, top, mask);

  // Liquid edge highlight at the boundary
  float ring = exp(-edge * edge * 800.0);
  col += ring * vec3(0.95, 0.85, 1.0) * 0.55;

  // Subtle vignette for depth
  float vig = smoothstep(1.4, 0.4, length((uv - 0.5) * uAspect));
  col *= 0.55 + 0.45 * vig;

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
    "WebGL fragment shader with domain-warped FBM. Drag the slider to scrub the reveal: it grows from your cursor like ink spreading through water. Click to cycle the palette; kinem's `playUniforms` smooth-crossfades between four palettes via the `uPaletteIndex` uniform.",
  group: "Showcase",
  mount(stage) {
    const wrap = document.createElement("div")
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      cursor: "crosshair",
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let aspect: [number, number] = [1, 1]
    const resize = (): void => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      canvas.width = Math.max(1, w * dpr)
      canvas.height = Math.max(1, h * dpr)
      const max = Math.max(w, h)
      aspect = [w / max, h / max]
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
    const uMouseLoc = gl.getUniformLocation(prog, "uMouse")
    const uPaletteLoc = gl.getUniformLocation(prog, "uPaletteIndex")
    const uAspectLoc = gl.getUniformLocation(prog, "uAspect")

    // Animated state
    let mouseTargetX = 0.5
    let mouseTargetY = 0.5
    let mouseX = 0.5
    let mouseY = 0.5
    let progressTarget = 0
    let progress = 0
    let paletteIdx = 0

    // Slider UI
    const sliderTrack = document.createElement("div")
    Object.assign(sliderTrack.style, {
      position: "absolute",
      left: "8%",
      right: "8%",
      bottom: "44px",
      height: "10px",
      background: "rgba(20,18,40,0.55)",
      backdropFilter: "blur(8px)",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
      cursor: "ew-resize",
      touchAction: "none",
      userSelect: "none",
    })
    wrap.appendChild(sliderTrack)

    const sliderFill = document.createElement("div")
    Object.assign(sliderFill.style, {
      position: "absolute",
      inset: "0",
      borderRadius: "999px",
      background:
        "linear-gradient(90deg, rgba(167,139,250,0.85) 0%, rgba(244,114,182,0.85) 50%, rgba(251,191,36,0.85) 100%)",
      width: "0%",
      pointerEvents: "none",
      boxShadow: "0 0 24px rgba(244,114,182,0.55)",
    })
    sliderTrack.appendChild(sliderFill)

    const sliderThumb = document.createElement("div")
    Object.assign(sliderThumb.style, {
      position: "absolute",
      top: "50%",
      left: "0%",
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 30%, #fff, #f472b6 60%, #a78bfa 100%)",
      boxShadow: "0 0 18px rgba(244,114,182,0.85), 0 4px 12px rgba(0,0,0,0.45)",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
    })
    sliderTrack.appendChild(sliderThumb)

    const hint = document.createElement("div")
    hint.textContent = "drag the slider · click to cycle palette · move cursor to aim the reveal"
    Object.assign(hint.style, {
      position: "absolute",
      left: "50%",
      bottom: "16px",
      transform: "translateX(-50%)",
      color: "rgba(232,236,244,0.65)",
      fontSize: "11px",
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      fontWeight: "600",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    })
    wrap.appendChild(hint)

    const setProgress = (p: number, immediate = false): void => {
      progressTarget = Math.max(0, Math.min(1, p))
      if (immediate) progress = progressTarget
      sliderFill.style.width = `${progressTarget * 100}%`
      sliderThumb.style.left = `${progressTarget * 100}%`
    }

    let dragging = false
    const sliderPointer = (e: PointerEvent): void => {
      const r = sliderTrack.getBoundingClientRect()
      const p = (e.clientX - r.left) / r.width
      setProgress(p)
    }
    const onSliderDown = (e: PointerEvent): void => {
      dragging = true
      sliderTrack.setPointerCapture(e.pointerId)
      sliderPointer(e)
    }
    const onSliderMove = (e: PointerEvent): void => {
      if (dragging) sliderPointer(e)
    }
    const onSliderUp = (e: PointerEvent): void => {
      dragging = false
      sliderTrack.releasePointerCapture(e.pointerId)
    }
    sliderTrack.addEventListener("pointerdown", onSliderDown)
    sliderTrack.addEventListener("pointermove", onSliderMove)
    sliderTrack.addEventListener("pointerup", onSliderUp)
    sliderTrack.addEventListener("pointercancel", onSliderUp)

    // Cursor tracking on the wrap
    const onMove = (e: PointerEvent): void => {
      const r = wrap.getBoundingClientRect()
      mouseTargetX = (e.clientX - r.left) / r.width
      mouseTargetY = 1 - (e.clientY - r.top) / r.height
    }
    wrap.addEventListener("pointermove", onMove)

    // Click to cycle palette via playUniforms
    const palLike = {
      uniform1f(loc: WebGLUniformLocation | null, v: number): void {
        if (loc === uPaletteLoc) paletteIdx = v
      },
      uniform2fv(): void {},
      uniform3fv(): void {},
      uniform4fv(): void {},
      uniformMatrix4fv(): void {},
    }

    let paletteRun: ReturnType<typeof playUniforms> | null = null
    let paletteTarget = 0
    const cyclePalette = (): void => {
      paletteRun?.cancel()
      paletteTarget += 1
      paletteRun = playUniforms(
        tween({ uPaletteIndex: [paletteIdx, paletteTarget] }, { duration: 900, easing: easeInOut }),
        palLike,
        { uPaletteIndex: float(uPaletteLoc) },
      )
    }

    // Click on canvas (not slider) cycles palette
    const onCanvasDown = (e: PointerEvent): void => {
      if (e.target === sliderTrack || e.target === sliderFill || e.target === sliderThumb) return
      cyclePalette()
    }
    wrap.addEventListener("pointerdown", onCanvasDown)

    const onResize = (): void => resize()
    window.addEventListener("resize", onResize)

    // Render loop
    const start = performance.now()
    let rafId = 0
    const tick = (): void => {
      const t = (performance.now() - start) / 1000

      // Smooth follow cursor
      mouseX += (mouseTargetX - mouseX) * 0.12
      mouseY += (mouseTargetY - mouseY) * 0.12
      // Smooth slider value
      progress += (progressTarget - progress) * 0.18

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uTimeLoc, t)
      gl.uniform1f(uProgressLoc, progress)
      gl.uniform2f(uMouseLoc, mouseX, mouseY)
      gl.uniform1f(uPaletteLoc, paletteIdx)
      gl.uniform2f(uAspectLoc, aspect[0], aspect[1])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Auto-demo: sweep slider 0 -> 0.7 over a couple seconds
    const auto = window.setTimeout(() => setProgress(0.7), 500)

    return () => {
      window.clearTimeout(auto)
      cancelAnimationFrame(rafId)
      paletteRun?.cancel()
      wrap.removeEventListener("pointermove", onMove)
      wrap.removeEventListener("pointerdown", onCanvasDown)
      sliderTrack.removeEventListener("pointerdown", onSliderDown)
      sliderTrack.removeEventListener("pointermove", onSliderMove)
      sliderTrack.removeEventListener("pointerup", onSliderUp)
      sliderTrack.removeEventListener("pointercancel", onSliderUp)
      window.removeEventListener("resize", onResize)
    }
  },
}
