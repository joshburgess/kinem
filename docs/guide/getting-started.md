# Getting started

Motif is a functional animation library for TypeScript. Animations are pure
functions from progress `[0, 1]` to a property bag, which you compose with
combinators and then hand to a renderer.

## Install

::: code-group

```sh [pnpm]
pnpm add motif-animate
```

```sh [npm]
npm install motif-animate
```

```sh [yarn]
yarn add motif-animate
```

:::

## Your first animation

```ts
import { easeOut, play, tween } from "motif-animate"

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
import { easeInOut, parallel, play, sequence, spring, tween } from "motif-animate"

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

## Try it locally

The repo ships a live playground with 19 working examples covering
tweens, springs, staggers, scroll, gestures, SVG, Canvas, and WebGL:

```sh
git clone https://github.com/joshburgess/motif
cd motif
pnpm install
pnpm --filter @motif-animate/examples-playground dev
```

## Where to next

- [Core concepts](/guide/concepts) covers the `AnimationDef` contract and how
  easings and durations interact.
- [Migrating from GSAP](/migrations/gsap) and
  [from Motion One](/migrations/motion) map common patterns.
