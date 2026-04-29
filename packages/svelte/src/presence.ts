/**
 * `createPresence` is Svelte's equivalent of React's `<AnimatePresence>`
 * pattern, scoped to a single host element. It keeps a `shouldRender`
 * store true while an exit animation runs, then flips it false once the
 * caller signals `safeToRemove()`.
 *
 *   <script>
 *     import { createPresence, motion } from "@kinem/svelte"
 *     export let show = true
 *
 *     const p = createPresence(() => show)
 *
 *     async function onExitDone() { p.safeToRemove() }
 *   </script>
 *
 *   {#if $shouldRender}
 *     <div
 *       use:motion={{
 *         initial: { opacity: 0 }, animate: { opacity: 1 },
 *         transition: { duration: 200 },
 *       }}
 *     >
 *       hello
 *     </div>
 *   {/if}
 *
 * Lifecycle:
 *  - Upstream `when` is true:  `$isPresent` true,  `$shouldRender` true.
 *  - Upstream `when` flips false: `$isPresent` false, `$shouldRender`
 *    stays true so the consumer can run an exit animation.
 *  - Caller invokes `safeToRemove()`: `$shouldRender` flips false; the
 *    `{#if}` block unmounts.
 *  - Upstream `when` returns to true: state resets so a future cycle
 *    runs from scratch.
 *
 * The caller refreshes the upstream view by invoking `update(value)`
 * (or by passing a thunk that closes over a reactive variable, in
 * which case Svelte's reactivity calls the subscriber with the new
 * value via the standard store contract).
 */

export interface PresenceReadable<T> {
  subscribe(fn: (value: T) => void): () => void
}

export interface PresenceController {
  /** Reactive store: true while upstream `when` is true. */
  readonly isPresent: PresenceReadable<boolean>
  /**
   * Reactive store: true while the consumer should keep the element
   * in the DOM. Stays true during the exit window until
   * `safeToRemove()` is called.
   */
  readonly shouldRender: PresenceReadable<boolean>
  /**
   * Push the latest upstream value. Call from a Svelte `$:` block or
   * a `$effect` so the presence stays in sync with reactive state.
   */
  update(value: boolean): void
  /** Caller invokes once the exit animation has settled. */
  safeToRemove(): void
}

function makeStore<T>(initial: T): {
  store: PresenceReadable<T>
  set(v: T): void
  get(): T
} {
  let current: T = initial
  const subs = new Set<(v: T) => void>()
  const store: PresenceReadable<T> = {
    subscribe(fn) {
      subs.add(fn)
      fn(current)
      return () => {
        subs.delete(fn)
      }
    },
  }
  return {
    store,
    set(v) {
      if (Object.is(v, current)) return
      current = v
      for (const s of subs) s(v)
    },
    get() {
      return current
    },
  }
}

export interface CreatePresenceOpts {
  readonly initial?: boolean
}

export function createPresence(opts: CreatePresenceOpts = {}): PresenceController {
  const initial = opts.initial ?? true
  const isPresent = makeStore<boolean>(initial)
  const shouldRender = makeStore<boolean>(true)
  let removed = false

  return {
    isPresent: isPresent.store,
    shouldRender: shouldRender.store,
    update(value) {
      if (value) {
        // Returning to present resets the latch so a future exit cycle
        // can defer again.
        removed = false
        isPresent.set(true)
        shouldRender.set(true)
      } else {
        isPresent.set(false)
        shouldRender.set(!removed)
      }
    },
    safeToRemove() {
      removed = true
      if (!isPresent.get()) shouldRender.set(false)
    },
  }
}
