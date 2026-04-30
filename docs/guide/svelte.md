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

## `kinemAnimate` factory

`kinemAnimate(node)` returns `{ animate }` for imperative animation
against elements inside `node`. Wire it via a setup action and bind the
returned `animate` in your component script.

```svelte
<script lang="ts">
  import { kinemAnimate, type KinemAnimateApi } from "@kinem/svelte"

  let api: KinemAnimateApi
  const setup = (node: HTMLElement) => { api = kinemAnimate(node) }

  const items = ["one", "two", "three"]
</script>

<ul use:setup>
  {#each items as v (v)}<li class="row">{v}</li>{/each}
</ul>
<button on:click={() => api.animate("li.row", { opacity: [0, 1], y: [12, 0] }, { duration: 300 })}>
  play
</button>
```

`animate(target, props, opts)` accepts a CSS selector resolved within
the node, an `Element`, or an `Element[]`. It returns the same `Controls`
handle `play()` produces, so you can `await controls.finished`, cancel,
pause, or scrub.

## `time` and `velocity` stores

`time()` returns a self-driving `MotionValue<number>` of milliseconds
since creation; it auto-starts an rAF loop on the first subscriber and
stops on the last. `velocity(source)` derives a per-second derivative of
any source `MotionValue`. Both expose Svelte's `subscribe` contract, so
the `$` prefix works:

```svelte
<script lang="ts">
  import { motionValue, time, velocity } from "@kinem/svelte"

  const t = time()
  const x = motionValue(0)
  const vx = velocity(x)
</script>

<span>{$t.toFixed(0)} ms / {$vx.toFixed(1)} px·s⁻¹</span>
```

`motionValueEvent(mv, "change", listener)` is also re-exported from
core for one-off subscriptions outside reactive contexts.

## `use:reorderGroup` and `use:reorderItem`

Drag-to-sort lists. The group action owns the `values` array and the
`onReorder` callback; each item action registers itself with the group,
becomes draggable along the group's `axis`, and asks the group to commit
a new order whenever the dragged item's center crosses a neighbour's.

```svelte
<script lang="ts">
  import { reorderGroup, reorderItem } from "@kinem/svelte"

  let items = $state(["read", "write", "ship"])
</script>

<ul use:reorderGroup={{ values: items, onReorder: (n) => items = n }}>
  {#each items as v (v)}
    <li use:reorderItem={{ value: v }}>{v}</li>
  {/each}
</ul>
```

`axis` defaults to `"y"`; pass `"x"` for horizontal lists. The parent
action MUST be attached before the child actions mount; Svelte's natural
mount order (parent before child actions) makes this the default.

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
