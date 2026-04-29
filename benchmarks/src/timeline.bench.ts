import { easeOut, timeline, tween } from "@kinem/core"
import { bench, describe } from "vitest"

/**
 * Timeline orchestration: add() loops with N entries, then resolve()
 * via the slotted-defs path. Construction is the hot path here because
 * timeline.play() is typically called once per scene; .add() bulk
 * loading is also benched since it's where label-resolution and
 * position arithmetic live.
 */

function bareLeaf() {
  return tween({ x: [0, 100] }, { duration: 200, easing: easeOut })
}

const labelTarget: Record<string, number> = { x: 0 }

describe("timeline.add(): 100 entries, default position", () => {
  bench("build", () => {
    const tl = timeline()
    for (let i = 0; i < 100; i++) tl.add(bareLeaf(), labelTarget)
  })
})

describe("timeline.add(): 1000 entries, default position", () => {
  bench("build", () => {
    const tl = timeline()
    for (let i = 0; i < 1000; i++) tl.add(bareLeaf(), labelTarget)
  })
})

describe("timeline.add(): 100 entries, label-positioned", () => {
  bench("build", () => {
    const tl = timeline()
    tl.addLabel("start", 0)
    for (let i = 0; i < 100; i++) {
      tl.add(bareLeaf(), labelTarget, { at: "start", offset: i * 50 })
    }
  })
})

describe("timeline.add(): 100 entries, relative-positioned", () => {
  bench("build", () => {
    const tl = timeline()
    for (let i = 0; i < 100; i++) {
      tl.add(bareLeaf(), labelTarget, { at: i === 0 ? 0 : "<", offset: 25 })
    }
  })
})
