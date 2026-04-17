import { describe, expect, it } from "vitest"
import { tween } from "../api/tween"
import { interpolate } from "../interpolate/registry"
import { createClock } from "../scheduler/clock"
import { type RafLike, createFrameScheduler } from "../scheduler/frame"
import { type GLLike, float, mat4, playUniforms, vec2, vec3, vec4 } from "./webgl"

function makeRaf() {
  let nextId = 1
  const pending = new Map<number, (t: number) => void>()
  const raf: RafLike = {
    request(cb) {
      const id = nextId++
      pending.set(id, cb)
      return id
    },
    cancel(id) {
      pending.delete(id)
    },
  }
  return {
    raf,
    fire(time: number) {
      const entry = [...pending].at(-1)
      if (!entry) return
      const [id, cb] = entry
      pending.delete(id)
      cb(time)
    },
  }
}

function setup() {
  const m = makeRaf()
  let now = 0
  const scheduler = createFrameScheduler({ raf: m.raf, now: () => now })
  const clock = createClock({ now: () => now })
  return {
    scheduler,
    clock,
    raf: m,
    advance(ms: number) {
      now += ms
    },
    tick() {
      m.fire(now)
    },
  }
}

interface Call {
  readonly fn: string
  readonly loc: unknown
  readonly value: unknown
  readonly transpose?: boolean
}

function makeGl(): { gl: GLLike; calls: Call[] } {
  const calls: Call[] = []
  const gl: GLLike = {
    uniform1f(loc, v) {
      calls.push({ fn: "uniform1f", loc, value: v })
    },
    uniform2fv(loc, v) {
      calls.push({ fn: "uniform2fv", loc, value: [...v] })
    },
    uniform3fv(loc, v) {
      calls.push({ fn: "uniform3fv", loc, value: [...v] })
    },
    uniform4fv(loc, v) {
      calls.push({ fn: "uniform4fv", loc, value: [...v] })
    },
    uniformMatrix4fv(loc, transpose, v) {
      calls.push({ fn: "uniformMatrix4fv", loc, value: [...v], transpose })
    },
  }
  return { gl, calls }
}

describe("interpolate(number[])", () => {
  it("blends component-wise between equal-length arrays", () => {
    const fn = interpolate([1, 2, 3], [3, 4, 5])
    expect(fn(0)).toEqual([1, 2, 3])
    expect(fn(0.5)).toEqual([2, 3, 4])
    expect(fn(1)).toEqual([3, 4, 5])
  })

  it("throws on length mismatch", () => {
    expect(() => interpolate([1, 2], [1, 2, 3])).toThrow(/length mismatch/)
  })
})

describe("playUniforms", () => {
  it("applies float uniform each frame", async () => {
    const env = setup()
    const { gl, calls } = makeGl()
    const loc = {} as WebGLUniformLocation
    const def = tween({ uAlpha: [0, 1] }, { duration: 100 })
    const h = playUniforms(
      def,
      gl,
      { uAlpha: float(loc) },
      { scheduler: env.scheduler, clock: env.clock },
    )
    env.advance(0)
    env.tick()
    env.advance(50)
    env.tick()
    const alphaCalls = calls.filter((c) => c.fn === "uniform1f")
    expect(alphaCalls.length).toBeGreaterThan(0)
    expect(alphaCalls[0]!.loc).toBe(loc)
    expect(alphaCalls.at(-1)!.value).toBeGreaterThan(0)
    h.cancel()
    await h.finished.catch(() => {})
  })

  it("dispatches vec2/vec3/vec4 to the correct setters", async () => {
    const env = setup()
    const { gl, calls } = makeGl()
    const l2 = { k: 2 } as unknown as WebGLUniformLocation
    const l3 = { k: 3 } as unknown as WebGLUniformLocation
    const l4 = { k: 4 } as unknown as WebGLUniformLocation
    const def = tween(
      {
        uV2: [
          [0, 0],
          [10, 20],
        ],
        uV3: [
          [0, 0, 0],
          [1, 2, 3],
        ],
        uV4: [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
        ],
      },
      { duration: 100 },
    )
    const h = playUniforms(
      def,
      gl,
      { uV2: vec2(l2), uV3: vec3(l3), uV4: vec4(l4) },
      { scheduler: env.scheduler, clock: env.clock },
    )
    env.tick()
    env.advance(100)
    env.tick()
    env.tick()
    await h.finished
    const last2 = calls.filter((c) => c.fn === "uniform2fv").at(-1)
    const last3 = calls.filter((c) => c.fn === "uniform3fv").at(-1)
    const last4 = calls.filter((c) => c.fn === "uniform4fv").at(-1)
    expect(last2).toBeDefined()
    expect(last2!.loc).toBe(l2)
    expect(last2!.value).toEqual([10, 20])
    expect(last3!.loc).toBe(l3)
    expect(last3!.value).toEqual([1, 2, 3])
    expect(last4!.loc).toBe(l4)
    expect(last4!.value).toEqual([1, 1, 1, 1])
  })

  it("applies mat4 with transpose flag", async () => {
    const env = setup()
    const { gl, calls } = makeGl()
    const loc = {} as WebGLUniformLocation
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const scaled = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]
    const def = tween({ uMat: [identity, scaled] }, { duration: 100 })
    const h = playUniforms(
      def,
      gl,
      { uMat: mat4(loc, true) },
      { scheduler: env.scheduler, clock: env.clock },
    )
    env.tick()
    env.advance(100)
    env.tick()
    env.tick()
    await h.finished
    const last = calls.filter((c) => c.fn === "uniformMatrix4fv").at(-1)
    expect(last).toBeDefined()
    expect(last!.transpose).toBe(true)
    expect(last!.value).toEqual(scaled)
  })

  it("returns a handle with pause/seek/cancel", async () => {
    const env = setup()
    const { gl } = makeGl()
    const loc = {} as WebGLUniformLocation
    const def = tween({ uAlpha: [0, 1] }, { duration: 1000 })
    const h = playUniforms(
      def,
      gl,
      { uAlpha: float(loc) },
      { scheduler: env.scheduler, clock: env.clock },
    )
    expect(typeof h.pause).toBe("function")
    expect(typeof h.seek).toBe("function")
    h.cancel()
    await expect(h.finished).rejects.toThrow("cancelled")
  })
})
