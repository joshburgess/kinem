/**
 * WebGL uniform animation driver. Thin wrapper over `playCanvas` that
 * commits interpolated values by calling `gl.uniformNfv()` on pre-bound
 * uniform locations. The shape of each binding (float / vec2 / vec3 /
 * vec4 / mat4) is declared once up front; the driver dispatches to the
 * right setter every frame without reflection.
 *
 *   const alphaLoc = gl.getUniformLocation(program, "uAlpha")
 *   const colorLoc = gl.getUniformLocation(program, "uColor")
 *
 *   const h = playUniforms(
 *     tween({ uAlpha: [0, 1], uColor: [[1, 0, 0], [0, 1, 0]] }, { duration: 600 }),
 *     gl,
 *     {
 *       uAlpha: float(alphaLoc),
 *       uColor: vec3(colorLoc),
 *     },
 *   )
 *
 * Vector values in the animated `def` are plain `number[]`; the
 * registered `"numbers"` interpolator blends them component-wise. Use
 * matching lengths for each `[from, to]` pair.
 *
 * The `gl` parameter is structurally typed: any object with the handful
 * of `uniform*` methods below will do. This makes the driver testable
 * without a real GL context and works with WebGL2 and headless stubs.
 */

import type { AnimationDef } from "../core/types"
import { type CanvasHandle, type CanvasOpts, playCanvas } from "./canvas"

export type UniformLocation = WebGLUniformLocation | null

export interface GLLike {
  uniform1f(location: UniformLocation, v: number): void
  uniform2fv(location: UniformLocation, v: Float32Array | readonly number[]): void
  uniform3fv(location: UniformLocation, v: Float32Array | readonly number[]): void
  uniform4fv(location: UniformLocation, v: Float32Array | readonly number[]): void
  uniformMatrix4fv(
    location: UniformLocation,
    transpose: boolean,
    v: Float32Array | readonly number[],
  ): void
}

/**
 * A declaration of how to commit a single uniform's value to the GPU.
 * Produced by the binding helpers below (`float`, `vec2`, `vec3`,
 * `vec4`, `mat4`) or hand-rolled for custom uniform types.
 */
export interface UniformBinding<T = unknown> {
  readonly apply: (gl: GLLike, value: T) => void
}

export type UniformBindings<V> = { readonly [K in keyof V]: UniformBinding<V[K]> }

export function float(loc: UniformLocation): UniformBinding<number> {
  return { apply: (gl, v) => gl.uniform1f(loc, v) }
}

export function vec2(loc: UniformLocation): UniformBinding<readonly number[]> {
  return { apply: (gl, v) => gl.uniform2fv(loc, v) }
}

export function vec3(loc: UniformLocation): UniformBinding<readonly number[]> {
  return { apply: (gl, v) => gl.uniform3fv(loc, v) }
}

export function vec4(loc: UniformLocation): UniformBinding<readonly number[]> {
  return { apply: (gl, v) => gl.uniform4fv(loc, v) }
}

export function mat4(loc: UniformLocation, transpose = false): UniformBinding<readonly number[]> {
  return { apply: (gl, v) => gl.uniformMatrix4fv(loc, transpose, v) }
}

export type WebGLHandle = CanvasHandle
export type WebGLOpts = CanvasOpts

export function playUniforms<V extends Record<string, unknown>>(
  def: AnimationDef<V>,
  gl: GLLike,
  bindings: UniformBindings<V>,
  opts: WebGLOpts = {},
): WebGLHandle {
  const keys = Object.keys(bindings) as Array<keyof V & string>
  return playCanvas(
    def,
    (values) => {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as keyof V & string
        const binding = bindings[key]
        binding.apply(gl, values[key])
      }
    },
    opts,
  )
}
