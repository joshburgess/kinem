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
pnpm add @kinem/solid
```

## What's in the box

- **Primitives**: `tween`, `spring`, `keyframes`. Every value type (numbers,
  colors, CSS units, transforms, SVG paths, number arrays) is interpolated
  through a dispatch registry you can extend.
- **Composition**: `parallel`, `sequence`, `stagger`, `map`, `loop`,
  `reverse`, `delay`, `timeline()`.
- **Renderers**: `play()` auto-routes compositor-safe properties to WAAPI
  and the rest to rAF. `playValues()`, `playUniforms()` (WebGL), and
  `strokeDraw` cover Canvas 2D, WebGL, and SVG paths.
- **Interactions**: `scroll()` for scroll-linked and scroll-triggered
  animations, `gesture()` for drag and hover, with the same handle API as
  time-based play.
- **Text**: `splitText()` with optional grapheme-aware character splitting,
  plus `fromGrid`, `shuffle`, and `wave` stagger patterns.
- **Adapters**: First-party React, Vue, Svelte, and Solid bindings.
- **DevTools**: A tracker channel every renderer reports to, consumable by
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

## Performance

Real-browser benchmarks against motion and gsap. Same scenarios, same
machine (Chrome on an M-series Mac), n=1000 elements per scenario,
median of 21 samples per (lib, scenario) pair, with the page reloaded
between pairs to avoid composite-cache and ticker-list pollution.
Wall time in milliseconds, lower is better:

| scenario            | kinem (auto) | kinem (main) | motion |  gsap |
|---------------------|-------------:|-------------:|-------:|------:|
| startup-commit      |          8.6 |          2.0 |    9.1 |  10.8 |
| startup-shared-def  |          8.6 |          1.7 |   11.8 |  11.3 |
| cancel-before-first |          0.6 |          0.3 |    4.5 |   0.4 |
| steady-state        |         79.5 |         70.0 |   86.4 |  79.0 |

In `mode: "main"` (rAF, the same model GSAP uses) kinem is fastest on
every scenario: roughly 5x faster startup than GSAP, ~7x faster on a
shared `AnimationDef`, faster cancel-before-first, and faster
steady-state than both gsap and motion.

The default `mode: "auto"` routes compositor-safe properties through
`Element.animate()` so the GPU drives ticking. That trades a small
startup cost for animations that keep running smoothly even if the
main thread is busy. Even in this mode kinem's cancel-before-first
stays around 0.6 ms; motion is 4.5 ms in the same harness because it
pays full WAAPI setup before it can tear down.

Reproduce with `pnpm -C benchmarks/browser bench:compare --n 1000
--samples 5`. Methodology, harness notes, and the full optimization
log live in `benchmarks/browser/README.md`.

Picking a mode? See the [renderer modes guide](docs/guide/renderer-modes.md)
for the full breakdown of `"compositor"`, `"main"`, and `"auto"`,
plus a decision table for when to reach for which.

## Bundle size

About half the size of motion, ~40% the size of gsap. Same recipe
(animate one element's `opacity` and `x`), bundled the same way
(esbuild, ESM, minified + gzipped):

| library | min + gzip |
|---------|-----------:|
| **kinem** (slim) | 6.6 kB |
| **kinem** (default) | 10.5 kB |
| anime.js | 11.4 kB |
| motion | 22.1 kB |
| gsap | 27.1 kB |

The slim entry (`@kinem/core/slim`) skips the color, transform, path,
and CSS-unit interpolator registrations. Use it when you only animate
numbers, or want to register a custom subset via `registerInterpolator`.
Per-entry breakdown via `pnpm size`; cross-library comparison via
`pnpm size:compare`.

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

### Solid

```tsx
import { Motion } from "@kinem/solid"

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

## Status

This is a work-in-progress library. Public versions are `0.x` and minor
versions may make breaking changes. See [CHANGELOG.md](CHANGELOG.md) for
per-release notes.

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
