import { easeInOut, float, playUniforms, tween, vec3 } from "@kinem/core"
import type { Example } from "../example"

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 outColor;
void main() { outColor = vec4(uColor, uAlpha); }
`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed")
  }
  return s
}

export const webglUniforms: Example = {
  id: "webgl-uniforms",
  title: "WebGL playUniforms()",
  description: "Animates uColor (vec3) and uAlpha (float) uniforms on a full-screen quad.",
  mount(stage) {
    const canvas = document.createElement("canvas")
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.width = stage.clientWidth
    canvas.height = stage.clientHeight
    stage.appendChild(canvas)

    const gl = canvas.getContext("webgl2")
    if (!gl) {
      stage.innerHTML = '<pre style="color:#f87171; padding:16px">WebGL2 not available</pre>'
      return () => {}
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uColor = gl.getUniformLocation(prog, "uColor")
    const uAlpha = gl.getUniformLocation(prog, "uAlpha")

    const render = (): void => {
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const glLike = {
      uniform1f(l: WebGLUniformLocation | null, v: number) {
        gl.uniform1f(l, v)
        render()
      },
      uniform2fv(_l: WebGLUniformLocation | null, _v: Float32Array | readonly number[]) {},
      uniform3fv(l: WebGLUniformLocation | null, v: Float32Array | readonly number[]) {
        gl.uniform3fv(l, v as Float32Array | number[])
      },
      uniform4fv(_l: WebGLUniformLocation | null, _v: Float32Array | readonly number[]) {},
      uniformMatrix4fv(
        _l: WebGLUniformLocation | null,
        _t: boolean,
        _v: Float32Array | readonly number[],
      ) {},
    }

    const run = (): ReturnType<typeof playUniforms> =>
      playUniforms(
        tween(
          {
            uColor: [
              [0.5, 0.6, 1.0],
              [0.96, 0.62, 0.04],
            ],
            uAlpha: [0.3, 1.0],
          },
          { duration: 1600, easing: easeInOut },
        ),
        glLike,
        {
          uColor: vec3(uColor),
          uAlpha: float(uAlpha),
        },
      )

    let ctrl = run()
    const interval = setInterval(() => {
      ctrl.cancel()
      ctrl = run()
    }, 1900)

    return () => {
      clearInterval(interval)
      ctrl.cancel()
    }
  },
}
