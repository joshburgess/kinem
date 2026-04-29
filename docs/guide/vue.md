# Vue

`@kinem/vue` is the Vue 3 adapter. Composables bind the vanilla `play()`
API to template refs. Vue's reactivity is never used to drive per-frame
state.

## Install

```sh
pnpm add @kinem/vue @kinem/core
```

`@kinem/core` and `vue@>=3.4` are peer dependencies.

## `<Motion>` component

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

### Variants

`<Motion>` accepts a `variants` map of named `MotionValues`. When set,
`initial`, `animate`, `exit`, `whileHover`, and `whileTap` can each be a
string key (or array of keys, merged left-to-right) instead of an inline
values object.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { Motion, type Variants } from "@kinem/vue"

const drawer: Variants = {
  closed: { x: -240, opacity: 0 },
  open:   { x:    0, opacity: 1 },
}
const open = ref(false)
</script>

<template>
  <Motion
    :variants="drawer"
    initial="closed"
    :animate="open ? 'open' : 'closed'"
    :transition="{ duration: 280 }"
  />
</template>
```

A parent `<Motion>` whose `animate` is a key propagates that key to
descendants that have their own `variants` map but no explicit `animate`.
Each descendant resolves the inherited key against its own variants.

### whileHover / whileTap

`whileHover` and `whileTap` give a temporary state override while the
pointer is over (hover) or pressed (tap). Tap takes precedence over hover.

```vue
<template>
  <Motion
    :variants="{
      rest:  { scale: 1 },
      hover: { scale: 1.05 },
      press: { scale: 0.95 },
    }"
    initial="rest"
    animate="rest"
    whileHover="hover"
    whileTap="press"
    :transition="{ duration: 120 }"
  />
</template>
```

## `useAnimation`

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useAnimation } from "@kinem/vue"
import { easeOut, tween } from "@kinem/core"

const target = ref<HTMLElement | null>(null)
const anim = useAnimation(target)

function go() {
  anim.play(tween({ x: [0, 200] }, { duration: 400, easing: easeOut }))
}
</script>

<template>
  <div ref="target" @click="go">tap me</div>
</template>
```

`anim.play` cancels any in-flight animation. The composable cancels the
current one on unmount.

## `useSpring`

```vue
<script setup lang="ts">
import { useSpring } from "@kinem/vue"

const spring = useSpring(0, { stiffness: 220, damping: 20 })
spring.set(120)
</script>

<template>
  <div :style="{ transform: `translateX(${spring.value}px)` }" />
</template>
```

## `useGesture`

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useGesture } from "@kinem/vue"

const card = ref<HTMLElement | null>(null)
useGesture(card, { drag: { axis: "x", bounds: [-200, 200] } })
</script>

<template>
  <div ref="card" class="card" />
</template>
```

## `useScroll`

```vue
<script setup lang="ts">
import { ref } from "vue"
import { useScroll } from "@kinem/vue"

const section = ref<HTMLElement | null>(null)
useScroll(section, {
  trigger: { start: "top 80%", end: "bottom 20%" },
  onProgress: (p) => console.log(p),
})
</script>

<template>
  <section ref="section">scroll me</section>
</template>
```

## `useKinemTransition`

A drop-in for Vue's `<Transition>` `:css="false"` mode. Returns enter/leave
hooks wired to a kinem `tween`.

```vue
<script setup lang="ts">
import { useKinemTransition } from "@kinem/vue"

const hooks = useKinemTransition({
  values: { opacity: [0, 1], y: [10, 0] },
  enter: { duration: 200 },
  leave: { duration: 150 },
})
</script>

<template>
  <Transition :css="false" v-bind="hooks">
    <div v-if="open">toast</div>
  </Transition>
</template>
```

## `useReducedMotion`

```vue
<script setup lang="ts">
import { useReducedMotion } from "@kinem/vue"
const reduce = useReducedMotion()
</script>
```

## SSR

Every composable defers DOM access until `onMounted`, so server render is a
no-op. Nothing to configure.
