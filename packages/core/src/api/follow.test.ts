import { describe, expect, it } from "vitest"
import { follow } from "./follow"

interface FakeTarget {
  style: { setProperty(name: string, value: string): void }
  lastTransform: string | null
}

const mkTarget = (): FakeTarget => {
  const t: FakeTarget = {
    lastTransform: null,
    style: {
      setProperty(name, value) {
        if (name === "transform") t.lastTransform = value
      },
    },
  }
  return t
}

const mkScheduler = () => {
  let pending: ((time: number) => void) | null = null
  const raf = (cb: (time: number) => void): number => {
    pending = cb
    return 1
  }
  const cancelRaf = (): void => {
    pending = null
  }
  const tick = (time = performance.now()): void => {
    const cb = pending
    pending = null
    cb?.(time)
  }
  return { raf, cancelRaf, tick }
}

describe("follow", () => {
  it("snapTo aligns every follower instantly", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget()]
    const sched = mkScheduler()
    const h = follow(targets, { raf: sched.raf, cancelRaf: sched.cancelRaf })
    h.snapTo(50, 50)
    for (const t of targets) {
      expect(t.lastTransform).toBe("translate3d(50px, 50px, 0)")
    }
    h.cancel()
  })

  it("followers chase the leader over multiple frames", () => {
    const targets = [mkTarget(), mkTarget(), mkTarget()]
    const sched = mkScheduler()
    const h = follow(targets, {
      raf: sched.raf,
      cancelRaf: sched.cancelRaf,
      stiffness: 0.5,
      decay: 1,
    })
    h.snapTo(0, 0)
    h.setLeader(100, 0)
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    sched.tick()
    // After many frames they should be near the leader
    const last = targets[targets.length - 1]?.lastTransform ?? ""
    const m = /translate3d\(([\-\d\.]+)px,/.exec(last)
    expect(Number(m?.[1])).toBeGreaterThan(50)
    h.cancel()
  })

  it("decay reduces follower stiffness down the chain", () => {
    const targets = [mkTarget(), mkTarget()]
    const sched = mkScheduler()
    const h = follow(targets, {
      raf: sched.raf,
      cancelRaf: sched.cancelRaf,
      stiffness: 1,
      decay: 0.5,
    })
    h.snapTo(0, 0)
    h.setLeader(100, 0)
    sched.tick()
    const t0 = targets[0]?.lastTransform ?? ""
    const t1 = targets[1]?.lastTransform ?? ""
    const x0 = Number(/translate3d\(([\-\d\.]+)px,/.exec(t0)?.[1])
    const x1 = Number(/translate3d\(([\-\d\.]+)px,/.exec(t1)?.[1])
    // Head is fully snapped (stiffness 1) -> 100; second has stiffness 0.5
    // applied to (head_pos - 0) = 100, so x1 should be 50.
    expect(x0).toBeCloseTo(100, 5)
    expect(x1).toBeCloseTo(50, 5)
    h.cancel()
  })

  it("custom commit overrides default", () => {
    const log: string[] = []
    const targets = [mkTarget(), mkTarget()]
    const sched = mkScheduler()
    const h = follow(targets, {
      raf: sched.raf,
      cancelRaf: sched.cancelRaf,
      commit: (_t, x, y, idx) => log.push(`${idx}:${x.toFixed(0)},${y.toFixed(0)}`),
    })
    h.snapTo(7, 9)
    expect(log).toEqual(["0:7,9", "1:7,9"])
    h.cancel()
  })

  it("cancel stops scheduling future ticks", () => {
    const targets = [mkTarget()]
    const sched = mkScheduler()
    const h = follow(targets, { raf: sched.raf, cancelRaf: sched.cancelRaf })
    h.cancel()
    expect(h.state).toBe("cancelled")
  })
})
