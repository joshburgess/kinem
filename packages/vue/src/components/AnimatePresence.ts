/**
 * `<AnimatePresence>` defers unmount of keyed default-slot children so
 * each can play an exit animation before leaving the tree. It inspects
 * the slot on every render, detects keys that vanished, and keeps those
 * VNodes mounted (wrapped in a presence provider with `isPresent: false`)
 * until the child signals `safeToRemove()`.
 *
 *   <AnimatePresence>
 *     <Motion v-if="show" key="box"
 *             :initial="{ opacity: 0 }"
 *             :animate="{ opacity: 1 }"
 *             :exit="{ opacity: 0 }" />
 *   </AnimatePresence>
 *
 * Vue parity for the React `<AnimatePresence>`. Children must have an
 * explicit `key` to participate. Unkeyed nodes pass through unchanged.
 *
 * The child is responsible for calling `presence.safeToRemove()` once
 * its exit animation settles. The built-in `<Motion>` component does
 * this automatically when its `exit` prop is set.
 */

import { type VNode, cloneVNode, defineComponent, h, provide, shallowRef, watchEffect } from "vue"
import { PresenceKey, type PresenceValue } from "./presence"

interface TrackedChild {
  readonly key: string
  readonly vnode: VNode
  readonly present: boolean
}

function keyedSlotVNodes(slotResult: VNode[] | undefined): Map<string, VNode> {
  const map = new Map<string, VNode>()
  if (!slotResult) return map
  for (const vnode of slotResult) {
    if (vnode == null || typeof vnode !== "object") continue
    const key = vnode.key
    if (key == null) continue
    map.set(String(key), vnode)
  }
  return map
}

function reconcile(prev: readonly TrackedChild[], incoming: Map<string, VNode>): TrackedChild[] {
  const prevKeys = new Set(prev.map((t) => t.key))
  const next: TrackedChild[] = []
  for (const t of prev) {
    const current = incoming.get(t.key)
    if (current) {
      next.push({ key: t.key, vnode: current, present: true })
    } else {
      next.push({ key: t.key, vnode: t.vnode, present: false })
    }
  }
  for (const [key, vnode] of incoming) {
    if (!prevKeys.has(key)) {
      next.push({ key, vnode, present: true })
    }
  }
  return next
}

export const AnimatePresence = defineComponent({
  name: "AnimatePresence",
  setup(_props, { slots }) {
    const tracked = shallowRef<readonly TrackedChild[]>([])
    // Per-key presence values are stable references so children that
    // inject the presence don't re-trigger watchers when other keys
    // mount or unmount.
    const presenceByKey = new Map<string, PresenceValue & { _present: boolean }>()

    const ensurePresence = (key: string): PresenceValue & { _present: boolean } => {
      const existing = presenceByKey.get(key)
      if (existing) return existing
      const value = {
        _present: true,
        get isPresent(): boolean {
          return value._present
        },
        safeToRemove(): void {
          presenceByKey.delete(key)
          tracked.value = tracked.value.filter((t) => t.key !== key)
        },
      }
      presenceByKey.set(key, value)
      return value
    }

    watchEffect(() => {
      const slotResult = slots["default"]?.()
      const incoming = keyedSlotVNodes(slotResult)
      const next = reconcile(tracked.value, incoming)
      // Sync presence flags so the watcher inside <Motion> sees the change.
      for (const t of next) {
        const value = ensurePresence(t.key)
        value._present = t.present
      }
      tracked.value = next
    })

    return () =>
      tracked.value.map((t) => {
        const value = ensurePresence(t.key)
        return h(
          // Use a small wrapper component so each tracked child gets
          // its own provide scope without touching the host element.
          defineComponent({
            inheritAttrs: false,
            setup(_p, ctx) {
              provide(PresenceKey, value)
              return () => ctx.slots["default"]?.()
            },
          }),
          { key: t.key },
          { default: () => cloneVNode(t.vnode) },
        )
      })
  },
})
