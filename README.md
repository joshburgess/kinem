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
  and the rest to rAF. `playValues()`, `playUniforms()` (WebGL), and
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

Measured at the main entry with all built-in interpolators (esbuild,
ESM, minified + gzipped):

| scenario | min + gzip |
| --- | --- |
| `tween + play` | 10.5 kB |
| `tween + play` (slim entry) | 6.6 kB |
| `tween + scroll` | 12.0 kB |
| `tween + gesture` | 13.0 kB |
| full library surface | 17.9 kB |

The slim entry (`@kinem/core/slim`) skips the color, transform, path, and
CSS-unit interpolator registrations. Use it when you only animate numbers,
or when you want to register a custom subset via `registerInterpolator`.

### Versus other libraries

Same recipe (animate one element's `opacity` from 0 to 1 and `x` from 0 to
100 over 800 ms), bundled the same way:

| library | min + gzip | vs kinem |
| --- | --- | --- |
| **kinem** (default) | 10.49 kB | 1.00x |
| **kinem** (slim) | 6.55 kB | 0.62x |
| popmotion | 5.52 kB | 0.53x |
| anime.js | 11.36 kB | 1.08x |
| motion | 22.05 kB | 2.10x |
| gsap | 27.05 kB | 2.58x |

popmotion ships smaller because it's a primitive: the consumer writes the
DOM commit themselves. kinem's `play()` does the write for you, so the
fairer comparison is against motion or gsap, both of which have a
compositor-routing renderer baked in. Reproduce with `pnpm size:compare`.

## Reduced motion

`play()` honours `prefers-reduced-motion: reduce` when the consumer
opts in. Default is `"never"` (run animations as authored). Per-call:

```ts
play(entrance, ".card", { reducedMotion: "user" })
```

Or set a global default once at app startup:

```ts
import { setReducedMotionDefault } from "@kinem/core"
setReducedMotionDefault("user")
```

When the resolved decision is to snap, the final value is committed to
each target immediately and `finished` resolves on the next microtask;
no rAF or WAAPI setup happens. `prefersReducedMotion()` is exported for
ad-hoc checks.

## Framework usage

### React

```tsx
import { Motion } from "@kinem/react"

function Card() {
  return (
    <Motion
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 400 }}
    >
      hello
    </Motion>
  )
}
```

### Vue

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

### Svelte

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

## Status

This is a work-in-progress library. Public versions are `0.x` and minor
versions may make breaking changes. See [CHANGELOG.md](CHANGELOG.md) for
per-release notes.

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
