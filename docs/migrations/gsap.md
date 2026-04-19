# Migrating from GSAP

This guide is a rough-edges translation. GSAP's surface is much larger
than Kinem's, so some constructs have no direct equivalent. Most of
your tweening code maps to `tween()` with cosmetic changes.

## `gsap.to`

GSAP:

```js
gsap.to(".box", { x: 200, opacity: 1, duration: 0.6, ease: "power2.out" })
```

Kinem:

```ts
import { easeOut, play, tween } from "@kinem/core"

play(
  tween({ x: [0, 200], opacity: [0, 1] }, { duration: 600, easing: easeOut }),
  ".box",
)
```

Differences at a glance:

- Durations are milliseconds, not seconds.
- Tweens take explicit `[from, to]` pairs. Kinem does not read current
  element state to synthesize a `from`. This makes animations pure and
  testable, at the cost of requiring the author to provide starting
  values.
- `ease` is a function reference (`linear`, `easeIn`, `easeOut`,
  `easeInOut`, or a custom `cubicBezier(...)`), not a string.

## `gsap.from` / `gsap.fromTo`

`gsap.from` has no direct equivalent because Kinem does not read the
current value. `gsap.fromTo` maps directly to `tween()`:

```ts
tween({ x: [0, 200] }, { duration: 600 })
```

## `gsap.timeline`

GSAP:

```js
const tl = gsap.timeline()
tl.to(".a", { x: 100, duration: 0.4 })
tl.to(".b", { y: 50, duration: 0.4 }, "-=0.2")
```

Kinem:

```ts
import { play, timeline, tween } from "@kinem/core"

const tl = timeline()
  .add(tween({ x: [0, 100] }, { duration: 400 }), 0)
  .add(tween({ y: [0, 50] }, { duration: 400 }), "-=200")

play(tl.def, "*") // tl.def is an AnimationDef
```

`timeline()` produces an `AnimationDef` once built. You `play()` it
against a target set. Labels, relative offsets (`"-=200"`, `"+=100"`),
and absolute positions are supported.

## Stagger

GSAP:

```js
gsap.to(".item", { opacity: 1, stagger: 0.05 })
```

Kinem uses an explicit `stagger` combinator that works on an array of
definitions, one per target:

```ts
import { play, stagger, tween } from "@kinem/core"

const defs = Array.from({ length: 10 }, () =>
  tween({ opacity: [0, 1] }, { duration: 300 }),
)

const staggered = stagger(defs, { each: 50, from: "start" })
play(staggered, ".item")
```

Grid, shuffle, and wave patterns are exported as `fromGrid`, `shuffle`,
and `wave` from `@kinem/core`.

## ScrollTrigger

Most basic scroll use cases map to Kinem's `scroll()` helper:

```ts
import { scroll, tween } from "@kinem/core"

scroll(
  tween({ opacity: [0, 1] }, { duration: 1000 }),
  {
    trigger: ".section",
    start: "top 80%",
    end: "bottom 20%",
    scrub: true,
  },
)
```

Advanced ScrollTrigger features (pinning, snap, toggle classes) have
partial or no coverage today.

## What Kinem does not do

- Morph plugins, DrawSVG, MotionPath, Flip, and similar plugins are
  not included.
- There is no autoplay on import. Everything is opt-in.
- There is no global pause. Tracking is available via the devtools
  channel for building your own controls.
