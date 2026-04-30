# @kinem/svelte

Svelte bindings for [kinem](https://github.com/joshburgess/kinem). Provides
a `use:motion` action, a `spring` store whose value animates toward a
target, and custom transition functions compatible with Svelte's
`transition:` directive. Frame scheduling is handled by the core package;
Svelte's reactivity is never used to drive per-frame state.

```svelte
<script lang="ts">
  import { motion } from "@kinem/svelte"
</script>

<div
  use:motion={{
    initial: { opacity: 0, transform: "translateY(20px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 400 },
  }}
  class="card"
>
  hello
</div>
```

## Install

```sh
pnpm add @kinem/svelte @kinem/core
```

`@kinem/core` is a peer dependency.

## What's exported

- `motion`, `gesture`, `scroll`, `inView` actions
- `spring` store, `time()` and `velocity()` stores
- `motionValue`, `transform`, `combine` Svelte-store wrappers
- `motionValueEvent` (re-exported from core)
- `kinemAnimate(node)` factory for imperative `animate(target, props, opts)` calls
- `reorderGroup` and `reorderItem` actions for drag-to-sort lists
- `kinemTransition` for `transition:` directives
- `reducedMotion` store, `createReducedMotionStore`, `prefersReducedMotion`

```svelte
<script lang="ts">
  import { kinemAnimate, type KinemAnimateApi } from "@kinem/svelte"
  let api: KinemAnimateApi
  const setup = (node: HTMLElement) => { api = kinemAnimate(node) }
</script>

<ul use:setup>
  {#each items as i (i.id)}<li class="row">{i.label}</li>{/each}
</ul>
<button on:click={() => api.animate("li.row", { opacity: [0, 1] }, { duration: 300 })}>
  play
</button>
```

## Docs

Full guide and API reference in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
