---
"@kinem/core": minor
"@kinem/react": minor
"@kinem/vue": minor
"@kinem/svelte": minor
"@kinem/solid": minor
"@kinem/devtools": minor
---

Add `Reorder.Group` and `Reorder.Item` to `@kinem/react` for drag-to-sort lists. The group owns the `values` array and an `onReorder` callback; each item registers itself, becomes draggable along the group's `axis`, and asks the group to commit a new order whenever the dragged item's center crosses a neighbour's. Siblings translate to make room mid-drag, and the new order is committed on pointer release.

Add `motionGroup()` and `MotionGroupStore` to `@kinem/svelte`. A group store holds a current variant key (or inline values target); pass it as `group` on the `motion` action and any item without an explicit `animate` follows the group, so one state flip drives a whole subtree. Items with their own `animate` override the group.

Add step-back (`<`) and step-forward (`>`) buttons to the `@kinem/devtools` timeline scrubber, beside play/pause. Each click pauses every active animation and seeks it by 16 ms in the chosen direction, for frame-accurate inspection.

Honour `prefers-reduced-motion` on every animation entry point. The `useSpring` / `createSpring` hooks (React, Vue, Solid) and the Svelte `spring` store now snap to the target instead of tweening when the OS pref is set; the Svelte `kinemTransition` collapses delay and duration to 0; and the gesture `drag` release-to-origin animation snaps to its bounded target instead of springing back.
