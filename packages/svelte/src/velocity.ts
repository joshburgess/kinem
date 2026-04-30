/**
 * `velocity(source)` exposes a core `velocity()` MotionValue as a
 * Svelte readable store. The store mirrors the source's per-second
 * derivative and notifies subscribers on each source change.
 *
 *   import { motionValue, velocity } from "@kinem/svelte"
 *   const x = motionValue(0)
 *   const vx = velocity(x)
 *   $: console.log($vx)
 */

import { type MotionValue, type VelocityMotionValue, velocity as coreVelocity } from "@kinem/core"

export interface VelocityMotionValueStore extends VelocityMotionValue {
  subscribe(run: (value: number) => void): () => void
}

export function velocity(source: MotionValue<number>): VelocityMotionValueStore {
  const mv = coreVelocity(source)
  return {
    get: mv.get,
    set: mv.set,
    on: mv.on,
    getVelocity: mv.getVelocity,
    destroy: mv.destroy,
    subscribe(run): () => void {
      run(mv.get())
      return mv.on((value) => run(value))
    },
  }
}
