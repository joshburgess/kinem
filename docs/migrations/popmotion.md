# Migrating from Popmotion

Popmotion is a low-level animation primitive: you supply `from`/`to`
values and an `onUpdate` callback, and write the DOM commit yourself.
Kinem is one layer up: `play()` resolves the target and writes to it
for you. If you want the popmotion-style "give me the value, I'll
commit" shape, reach for `playValues()`.

## `animate`

Popmotion:

```js
import { animate } from "popmotion"

animate({
  from: 0,
  to: 200,
  duration: 600,
  ease: easeOut,
  onUpdate: (latest) => {
    box.style.transform = `translateX(${latest}px)`
  },
})
```

Kinem (high-level):

```ts
import { easeOut, play, tween } from "@kinem/core"

play(tween({ x: [0, 200] }, { duration: 600, easing: easeOut }), box)
```

Kinem (popmotion-style callback):

```ts
import { easeOut, playValues, tween } from "@kinem/core"

playValues(
  tween({ x: [0, 200] }, { duration: 600, easing: easeOut }),
  ({ x }) => {
    box.style.transform = `translateX(${x}px)`
  },
)
```

`playValues()` is the equivalent of popmotion's "you commit it yourself"
loop. It is also what you reach for with Canvas, WebGL, workers, or
anything that is not a DOM style write.

## Spring

Popmotion:

```js
animate({
  from: 0,
  to: 100,
  type: "spring",
  stiffness: 200,
  damping: 12,
  onUpdate,
})
```

Kinem:

```ts
import { play, spring } from "@kinem/core"

play(spring({ x: [0, 100] }, { stiffness: 200, damping: 12 }), box)
```

If you want the spring to compute the duration but still drive a
tween-shaped value, use `springEasing` as the easing:

```ts
import { play, springEasing, tween } from "@kinem/core"

play(
  tween(
    { x: [0, 100] },
    { easing: springEasing({ stiffness: 200, damping: 12 }) },
  ),
  box,
)
```

## Inertia / decay

Popmotion:

```js
animate({
  type: "inertia",
  from: 0,
  velocity: 1000,
  power: 0.8,
  timeConstant: 350,
  onUpdate,
})
```

Kinem:

```ts
import { inertia, playValues } from "@kinem/core"

playValues(
  inertia({ from: 0, velocity: 1000, power: 0.8, timeConstant: 350 }),
  (latest) => {
    box.scrollLeft = latest
  },
)
```

Combine with `gesture()` and `createVelocityTracker()` for momentum
scrolling and toss-style interactions; the `examples-showcase` package
has a working `toss-card` demo.

## Keyframes

Popmotion:

```js
animate({ from: 0, to: [0, 100, 50], duration: 1000, onUpdate })
```

Kinem:

```ts
import { keyframes, play } from "@kinem/core"

play(keyframes({ x: [0, 100, 50] }, { duration: 1000 }), box)
```

Stop offsets default to even distribution. Pass `offsets: [0, 0.3, 1]`
to shape the timing.

## Easings

Popmotion's easings are functions, same as Kinem. Direct mappings:

| popmotion | kinem |
| --- | --- |
| `linear` | `linear` |
| `easeIn` / `easeOut` / `easeInOut` | same names |
| `cubicBezier(...)` | `cubicBezier(...)` |
| `circIn` / `circOut` / `backIn` / `anticipate` | not built in. Use `cubicBezier()` to recreate the curve. |

```ts
import { cubicBezier } from "@kinem/core"

const backOut = cubicBezier(0.34, 1.56, 0.64, 1)
```

## Stagger

Popmotion does not ship a stagger primitive: you build it from
`animate` calls with offset start delays. Kinem has an explicit
combinator:

```ts
import { play, stagger, tween } from "@kinem/core"

const defs = Array.from({ length: 10 }, () =>
  tween({ opacity: [0, 1] }, { duration: 300 }),
)

play(stagger(defs, { each: 50 }), ".item")
```

`from: "start" | "end" | "center" | "edges"` plus the `fromGrid`,
`shuffle`, and `wave` helpers cover the common patterns.

## `pipe` / `interpolate` / `mix`

Popmotion's functional helpers (`pipe`, `interpolate`, `mix`) compose
small numeric transforms. Kinem exposes one equivalent:

- `interpolate(from, to)` from `@kinem/core` returns a function that
  blends two values of the same type, dispatching through the
  interpolator registry (numbers, colors, transforms, paths,
  CSS-with-units, number arrays). Register your own type with
  `registerInterpolator()`.

For composition, prefer `parallel`, `sequence`, `map`, `loop`,
`reverse`, and `delay` on `AnimationDef`s rather than wiring up
plain functions.

## Pointer / drag

Popmotion's `pointer({ x, y })` followed by an `animate` to commit
the position maps to Kinem's `gesture()`:

```ts
import { gesture } from "@kinem/core"

gesture(box, {
  drag: {
    onMove: ({ x, y }) => {
      box.style.transform = `translate(${x}px, ${y}px)`
    },
  },
})
```

`gesture()` returns the same handle shape as time-based `play()`,
so `cancel()` and `finished` work uniformly.

## Bundle size

Popmotion is the smaller package because it asks the consumer to
write the commit. Kinem's `play()` does the write for you, so the
fairer comparison is against motion or gsap. If you only want
numeric tweens and you commit yourself, reach for the slim entry:

```ts
import { play, tween } from "@kinem/core/slim"
```

The slim entry skips the color, transform, path, and CSS-unit
interpolator registrations. You can register a custom subset via
`registerInterpolator`.

## What Popmotion has that Kinem does not

- Standalone `transform.pipe`, `clamp`, `wrap` numeric helpers.
- The functional `listen()` event subscription layer.
- A "physics-only" mode without timing semantics. Kinem treats
  springs as either an `AnimationDef` (`spring()`) or as a duration
  source (`springEasing`); both still flow through the same play
  loop.
