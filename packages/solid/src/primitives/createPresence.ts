/**
 * `createPresence` is Solid's primitive equivalent of React's
 * `<AnimatePresence>` for a single child. It defers the "remove" signal
 * until the consumer explicitly calls `safeToRemove()`, giving the
 * caller a window to play an exit animation.
 *
 *   const show = () => someSignal()
 *   const presence = createPresence(show)
 *
 *   // Render only while we want the element in the DOM.
 *   <Show when={presence.shouldRender()}>
 *     <MyAnimatedThing
 *       isPresent={presence.isPresent()}
 *       onExitComplete={presence.safeToRemove}
 *     />
 *   </Show>
 *
 * Lifecycle:
 *  - Upstream `when` is true: `isPresent()` true, `shouldRender()` true.
 *  - Upstream `when` flips false: `isPresent()` false, `shouldRender()`
 *    stays true so the child can run its exit animation.
 *  - Child calls `safeToRemove()`: `shouldRender()` flips false; the
 *    `<Show>` unmounts.
 *  - Upstream `when` flips back to true: state resets.
 *
 * If `safeToRemove()` is never called the child stays mounted in the
 * "exiting" state. This is intentional. The primitive does not assume a
 * duration. Pair with a real animation that signals completion via
 * `controls.finished.then(presence.safeToRemove)`.
 */

import { type Accessor, createSignal, untrack } from "solid-js"

export interface CreatePresenceResult {
  /**
   * True while upstream `when` is true. Flips false during the exit
   * window so children can react and start their exit animation.
   */
  readonly isPresent: Accessor<boolean>
  /**
   * True while the child should remain in the DOM. Stays true during
   * the exit window until `safeToRemove()` is called.
   */
  readonly shouldRender: Accessor<boolean>
  /** Child calls this once its exit animation has finished. */
  readonly safeToRemove: () => void
}

export function createPresence(when: Accessor<boolean>): CreatePresenceResult {
  const [removed, setRemoved] = createSignal(false)

  const shouldRender: Accessor<boolean> = () => {
    const cur = when()
    // When upstream returns to present, reset the latch so a subsequent
    // exit cycle can re-trigger. `untrack` keeps the read out of the
    // computation graph so we don't subscribe to our own reset.
    if (cur && untrack(removed)) {
      setRemoved(false)
    }
    return cur || !removed()
  }

  return {
    isPresent: when,
    shouldRender,
    safeToRemove: () => setRemoved(true),
  }
}
