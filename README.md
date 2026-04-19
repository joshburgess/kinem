# Kinem

> Short for *kinematics*, or *kinema*, the Greek word for movement.

Functional, compositional animation for TypeScript. An animation is a pure
function from progress to value. You compose animations with ordinary
combinators, then hand the result to a renderer.

```ts
import { easeOut, parallel, play, sequence, spring, tween } from "@kinem/core"

const entrance = sequence(
  tween({ opacity: [0, 1] }, { duration: 200 }),
  parallel(
    spring({ y: [20, 0] }, { stiffness: 180, damping: 14 }),
    tween({ rotate: ["-5deg", "0deg"] }, { duration: 400, easing: easeOut }),
  ),
)

play(entrance, ".card")
```

`tween`, `spring`, `keyframes`, `parallel`, `sequence`, `stagger`, `timeline`
all return the same thing: an `AnimationDef`. There is no timeline engine,
no hidden state machine, and no callback into the DOM until `play()` runs.
That means animations are values you can test, serialize, debug, or sample
by hand.

## Install

```sh
pnpm add @kinem/core
# or: npm install @kinem/core
# or: yarn add @kinem/core
```

Framework adapters:

```sh
pnpm add @kinem/react
pnpm add @kinem/vue
pnpm add @kinem/svelte
```

## What's in the box

- **Primitives** — `tween`, `spring`, `keyframes`. Every value type (numbers,
  colors, CSS units, transforms, SVG paths, number arrays) is interpolated
  through a dispatch registry you can extend.
- **Composition** — `parallel`, `sequence`, `stagger`, `map`, `loop`,
  `reverse`, `delay`, `timeline()`.
- **Renderers** — `play()` auto-routes compositor-safe properties to WAAPI
  and the rest to rAF. `playCanvas()`, `playUniforms()` (WebGL), and
  `strokeDraw` cover Canvas 2D, WebGL, and SVG paths.
- **Interactions** — `scroll()` for scroll-linked and scroll-triggered
  animations, `gesture()` for drag and hover, with the same handle API as
  time-based play.
- **Text** — `splitText()` with optional grapheme-aware character splitting,
  plus `fromGrid`, `shuffle`, and `wave` stagger patterns.
- **Adapters** — First-party React, Vue, and Svelte bindings.
- **DevTools** — A tracker channel every renderer reports to, consumable by
  a standalone panel or your own UI.

## A longer example

```ts
import {
  easeInOut,
  fromGrid,
  play,
  stagger,
  tween,
} from "@kinem/core"

const tiles = Array.from(document.querySelectorAll<HTMLElement>(".tile"))

const wipe = stagger(
  tiles.map(() =>
    tween(
      { opacity: [0, 1], y: [16, 0] },
      { duration: 500, easing: easeInOut },
    ),
  ),
  { each: 40, from: fromGrid({ rows: 6, cols: 10, origin: "center" }) },
)

const controls = play(wipe, tiles)
controls.finished.then(() => console.log("done"))
```

## Bundle size

Measured at the main entry with all built-in interpolators:

| scenario | min + gzip |
| --- | --- |
| `tween + play` | 8.0 kB |
| `tween + play` (slim entry) | 4.3 kB |
| `tween + scroll` | 9.4 kB |
| `tween + gesture` | 9.4 kB |
| full library surface | 14.0 kB |

The slim entry (`@kinem/core/slim`) skips the color, transform, path, and
CSS-unit interpolator registrations. Use it when you only animate numbers,
or when you want to register a custom subset via `registerInterpolator`.

## Framework usage

### React

```tsx
import { useTween } from "@kinem/react"

function Card() {
  const ref = useTween<HTMLDivElement>(
    { opacity: [0, 1], y: [20, 0] },
    { duration: 400 },
  )
  return <div ref={ref} className="card">hello</div>
}
```

### Vue

```vue
<script setup lang="ts">
import { useTween } from "@kinem/vue"
const card = useTween({ opacity: [0, 1] }, { duration: 400 })
</script>

<template><div :ref="card" class="card">hello</div></template>
```

### Svelte

```svelte
<script lang="ts">
  import { tween } from "@kinem/svelte"
</script>

<div use:tween={{ opacity: [0, 1], duration: 400 }} class="card">hello</div>
```

## Status

This is a work-in-progress library. Public versions are `0.x` and minor
versions may make breaking changes. See
[CHANGELOG](https://github.com/joshburgess/kinem/releases) for per-release
notes.

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
