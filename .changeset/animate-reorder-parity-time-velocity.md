---
"@kinem/core": minor
"@kinem/react": minor
"@kinem/vue": minor
"@kinem/svelte": minor
"@kinem/solid": minor
---

Add `time()`, `velocity()`, and `motionValueEvent()` to `@kinem/core`. `time()` returns a `MotionValue<number>` of milliseconds since creation that auto-starts an rAF tick when the first listener attaches and stops when the last detaches. `velocity(source)` derives a per-second derivative `MotionValue` that mirrors the source. `motionValueEvent(mv, "change", listener)` is a small subscription wrapper for symmetry with the framework hooks.

Add `createReorderController()` to `@kinem/core` as a framework-agnostic engine that owns the rect math, sibling translates, and order commits for a drag-to-sort list. The React `Reorder` component now wraps it, and the new Vue, Solid, and Svelte adapters share the same engine, so the four implementations stay in lock-step.

Add `useTime`, `useVelocity`, `useMotionValueEvent`, and `useAnimate` to `@kinem/react`. `useAnimate()` returns `[scope, animate]`: bind `scope` as a ref and call `animate(target, props, opts)` to tween properties on a CSS selector resolved within the scope, an `Element`, or an `Element[]`.

Add `useTime`, `useVelocity`, `useMotionValueEvent`, `useAnimate`, and `ReorderGroup` / `ReorderItem` to `@kinem/vue` with the same shapes as their React counterparts.

Add `createTime`, `createVelocity`, `createMotionValueEvent`, `createAnimate`, and `ReorderGroup` / `ReorderItem` to `@kinem/solid`.

Add `time()` and `velocity()` stores, a `motionValueEvent` re-export, the `kinemAnimate(node)` factory, and `reorderGroup` / `reorderItem` actions to `@kinem/svelte`.
