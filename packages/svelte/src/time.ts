/**
 * `time()` exposes a core `time()` MotionValue as a Svelte readable
 * store. The store ticks on every animation frame while at least one
 * subscriber is attached and stops automatically when the last one
 * detaches. `subscribe()` runs the listener synchronously with the
 * current value, then on every rAF tick.
 *
 *   import { time, transform } from "@kinem/svelte"
 *   const t = time()
 *   const opacity = transform(t, [0, 2000], [0, 1])
 *   $: console.log($t)
 */

import { type TimeMotionValue, time as coreTime } from "@kinem/core"

export interface TimeMotionValueStore extends TimeMotionValue {
  subscribe(run: (value: number) => void): () => void
}

export function time(): TimeMotionValueStore {
  const mv = coreTime()
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
