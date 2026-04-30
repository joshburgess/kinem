# @kinem/vue

Vue bindings for [kinem](https://github.com/joshburgess/kinem). Composables
and a `<Motion>` component that wrap the vanilla `play()` and related APIs.
Animations run against template refs via WAAPI or rAF; Vue's reactivity is
never used to drive per-frame state updates.

```vue
<script setup lang="ts">
import { Motion } from "@kinem/vue"
</script>

<template>
  <Motion
    :initial="{ opacity: 0, y: 20 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 400 }"
  >
    hello
  </Motion>
</template>
```

## Install

```sh
pnpm add @kinem/vue @kinem/core
```

`@kinem/core` is a peer dependency.

## What's exported

- `useAnimation`, `useGesture`, `useScroll`, `useSpring` composables
- `useTime`, `useVelocity`, `useTransform`, `useCombine`, `useMotionValueEvent` for reactive value plumbing
- `useAnimate` for imperative `animate(target, props, opts)` calls scoped to a template ref
- `useInView` for IntersectionObserver-driven flags
- `useKinemTransition` for `<Transition>` integration
- `useReducedMotion`, `prefersReducedMotion`
- `<Motion>` component
- `<ReorderGroup>` and `<ReorderItem>` for drag-to-sort lists

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useAnimate } from "@kinem/vue"

const items = ref([{ id: 1, label: "one" }, { id: 2, label: "two" }])
const { scope, animate } = useAnimate()
const play = () => animate("li", { opacity: [0, 1] }, { duration: 300 })
</script>

<template>
  <ul :ref="scope">
    <li v-for="i in items" :key="i.id">{{ i.label }}</li>
  </ul>
  <button @click="play">play</button>
</template>
```

## Docs

Full guide and API reference in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
