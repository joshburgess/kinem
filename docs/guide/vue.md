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
