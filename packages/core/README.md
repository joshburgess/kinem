# @kinem/core

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
all return an `AnimationDef`. `play()` auto-routes compositor-safe properties
to WAAPI and the rest to rAF; `playValues()`, `playUniforms()`, and
`strokeDraw` cover Canvas 2D, WebGL, and SVG paths.

## Install

```sh
pnpm add @kinem/core
# or: npm install @kinem/core
# or: yarn add @kinem/core
```

For a smaller bundle that skips the color, transform, path, and CSS-unit
interpolators, import from `@kinem/core/slim` and register only what you
need via `registerInterpolator`.

## Framework adapters

- [`@kinem/react`](https://github.com/joshburgess/kinem/tree/main/packages/react)
- [`@kinem/vue`](https://github.com/joshburgess/kinem/tree/main/packages/vue)
- [`@kinem/svelte`](https://github.com/joshburgess/kinem/tree/main/packages/svelte)

## Docs

Full guide, API reference, and migration notes from gsap and motion in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
