# Svelte

`@kinem/svelte` is the Svelte 5 adapter. It exposes Svelte actions, stores,
and `transition:` helpers that wrap the vanilla `play()` API. Frame
scheduling stays in the core package; Svelte's reactivity is never used to
drive per-frame state.

## Install

```sh
pnpm add @kinem/svelte @kinem/core
```

`@kinem/core` and `svelte@>=5` are peer dependencies.

## `use:motion` action

```svelte
<script lang="ts">
  import { motion } from "@kinem/svelte"
</script>

<div
  use:motion={{
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 400 },
  }}
>
  hello
</div>
```

The action plays on mount with `initial → animate`, then re-plays whenever
`animate` changes.

## `spring` store

```svelte
<script lang="ts">
  import { spring } from "@kinem/svelte"

  const x = spring(0, { stiffness: 220, damping: 20 })
</script>

<button on:click={() => x.set(200)}>go</button>
<div style="transform: translateX({$x}px)" />
```

## `use:gesture` action

```svelte
<script lang="ts">
  import { gesture } from "@kinem/svelte"
</script>

<div use:gesture={{ drag: { axis: "x", bounds: [-200, 200] } }} class="card" />
```

## `use:scroll` action

```svelte
<script lang="ts">
  import { scroll } from "@kinem/svelte"
</script>

<section
  use:scroll={{
    trigger: { start: "top 80%", end: "bottom 20%" },
    onProgress: (p) => console.log(p),
  }}
>
  scroll me
</section>
```

## `kinemTransition`

Kinem-flavoured transition for Svelte's `transition:` directive.

```svelte
<script lang="ts">
  import { kinemTransition } from "@kinem/svelte"

  let open = $state(false)
</script>

<button on:click={() => open = !open}>toggle</button>
{#if open}
  <div transition:kinemTransition={{ values: { opacity: [0, 1], y: [10, 0] }, duration: 200 }}>
    toast
  </div>
{/if}
```

## `reducedMotion` store

```svelte
<script lang="ts">
  import { reducedMotion } from "@kinem/svelte"
</script>

{#if $reducedMotion}
  <Static />
{:else}
  <Animated />
{/if}
```

## SSR

Actions never run during SSR; stores read sane defaults so `$reducedMotion`
is `false` on the server. Nothing to configure.
