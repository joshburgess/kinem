<script setup>
const tryItHereCode = `const box = document.createElement('div')
box.className = 'box'
box.style.left = '24px'
box.style.top = '50%'
box.style.transform = 'translateY(-50%)'
stage.appendChild(box)

play(
  tween(
    { x: [0, 320], opacity: [0, 1] },
    { duration: 800, easing: easeOut },
  ),
  box,
)`
</script>

# Getting started

Kinem is a functional animation library for TypeScript. Animations are pure
functions from progress `[0, 1]` to a property bag, which you compose with
combinators and then hand to a renderer.

## Install

::: code-group

```sh [pnpm]
pnpm add @kinem/core
```

```sh [npm]
npm install @kinem/core
```

```sh [yarn]
yarn add @kinem/core
```

:::

## Your first animation

```ts
import { easeOut, play, tween } from "@kinem/core"

const box = document.querySelector(".box") as HTMLElement

play(
  tween(
    { x: [0, 200], opacity: [0, 1] },
    { duration: 600, easing: easeOut },
  ),
  box,
)
```

`tween()` returns an `AnimationDef`: a pure description of what changes,
over what duration, under what easing. `play()` binds it to a target and
runs it, returning a `Controls` handle with `pause`, `resume`, `seek`,
`reverse`, `cancel`, and a `finished` promise.

## Composing animations

```ts
import { easeInOut, parallel, play, sequence, spring, tween } from "@kinem/core"

const entrance = sequence(
  tween({ opacity: [0, 1] }, { duration: 200 }),
  parallel(
    spring({ y: [20, 0] }, { stiffness: 180, damping: 14 }),
    tween({ rotate: ["-5deg", "0deg"] }, { duration: 400, easing: easeInOut }),
  ),
)

play(entrance, ".card")
```

`sequence` runs children one after another. `parallel` runs them together.
Both produce a new `AnimationDef`, so you can keep composing without ever
touching the timeline.

## Try it here

Edit the code on the left. The preview updates after a short pause.
Every built-in export is already in scope — `play`, `tween`, `spring`,
`parallel`, `sequence`, `stagger`, `easeOut`, and the rest.

<Playground :code="tryItHereCode" />

Want more to explore? The repo ships a local playground with 19
working examples covering tweens, springs, staggers, scroll, gestures,
SVG, Canvas, and WebGL:

```sh
git clone https://github.com/joshburgess/kinem
cd kinem
pnpm install
pnpm --filter @kinem/examples-playground dev
```

## Where to next

- [Core concepts](/guide/concepts) covers the `AnimationDef` contract and how
  easings and durations interact.
- [Migrating from GSAP](/migrations/gsap) and
  [from Motion One](/migrations/motion) map common patterns.
