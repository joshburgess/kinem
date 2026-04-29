---
"@kinem/core": minor
"@kinem/react": minor
"@kinem/vue": minor
"@kinem/svelte": minor
"@kinem/solid": minor
---

Add a Framer Motion-style variants API to the React, Vue, Solid, and Svelte motion bindings. Variants accept a named map of `MotionValues`; the `initial`, `animate`, `whileHover`, and `whileTap` props (plus `exit` for components) each take an inline values object, a single variant key, or an array of keys merged left-to-right. Tap takes precedence over hover, hover over animate.

In React, Vue, and Solid, a parent `<Motion>` whose `animate` is a string key propagates that key down to descendants that have their own `variants` map but no explicit `animate`, so a single state flip can drive a whole subtree. Setting `transition.staggerChildren` on a parent staggers descendants in mount-order by that many milliseconds; only animate-key-driven changes stagger, while hover and tap never do. Per-element `transition.delay` defers the tween start by the given number of ms and composes with stagger.

Add `Controls.playLabel(name)` to `@kinem/core`. It seeks the running handle to the named label, flips a reversed timeline back to forward, resumes if paused, and re-arms a finished timeline so a labeled section can replay.
