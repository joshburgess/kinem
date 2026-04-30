/**
 * `animateScope(node)` is a Svelte action that captures `node` as the
 * scope for an imperative `animate()` call. The action returns
 * `{ animate, destroy }` where `animate(target, props, opts)` resolves
 * `target` (CSS selector queried within scope, an Element, or an
 * Element[]) and runs a `tween()` of `props` against each match.
 *
 * Because Svelte actions return their handle to the caller in their
 * imperative form, the typical pattern is to wire the action manually
 * via the `kinemAnimate(node)` factory and bind the returned `animate`
 * function in your component script:
 *
 *   <script lang="ts">
 *     import { kinemAnimate } from "@kinem/svelte"
 *     let api: ReturnType<typeof kinemAnimate>
 *     const setup = (node: HTMLElement) => { api = kinemAnimate(node) }
 *   </script>
 *   <ul use:setup>
 *     {#each items as i}<li class="row">{i}</li>{/each}
 *   </ul>
 *   <button on:click={() => api.animate("li.row", { opacity: [0, 1] }, { duration: 300 })}>
 */

import {
  type Controls,
  type PlayOpts,
  type TweenOpts,
  type TweenProps,
  play,
  tween,
} from "@kinem/core"

export type AnimateTarget = string | HTMLElement | readonly HTMLElement[]

export interface KinemAnimateApi {
  animate<P extends TweenProps>(
    target: AnimateTarget,
    props: P,
    opts?: TweenOpts & PlayOpts,
  ): Controls
}

const resolveTargets = (scope: HTMLElement | null, target: AnimateTarget): HTMLElement[] => {
  if (typeof target === "string") {
    if (!scope) return []
    return Array.from(scope.querySelectorAll<HTMLElement>(target))
  }
  if (Array.isArray(target)) return target as HTMLElement[]
  return [target as HTMLElement]
}

export function kinemAnimate(node: HTMLElement): KinemAnimateApi {
  return {
    animate<P extends TweenProps>(
      target: AnimateTarget,
      props: P,
      opts: TweenOpts & PlayOpts = {},
    ): Controls {
      const targets = resolveTargets(node, target)
      return play(tween(props, opts) as Parameters<typeof play>[0], targets, opts)
    },
  }
}
