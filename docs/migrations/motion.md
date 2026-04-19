# Migrating from Motion One

Motion One (the `motion` package) has the closest API shape to Kinem.
If you already use Motion, the jump is mostly surface changes.

## `animate`

Motion:

```js
import { animate } from "motion"

animate(".box", { x: 200, opacity: 1 }, { duration: 0.6, easing: "ease-out" })
```

Kinem:

```ts
import { easeOut, play, tween } from "kinem"

play(
  tween({ x: [0, 200], opacity: [0, 1] }, { duration: 600, easing: easeOut }),
  ".box",
)
```

Differences:

- Durations are milliseconds.
- Tweens take explicit `[from, to]` pairs. Motion reads the current
  element style to infer `from`. Kinem does not.
- `easing` is a function reference.

## Keyframe syntax

Motion accepts an array of values as a keyframe list:

```js
animate(".box", { x: [0, 100, 0] }, { duration: 1 })
```

Kinem uses `keyframes()` for multi-stop animations:

```ts
import { keyframes, play } from "kinem"

play(
  keyframes({ x: [0, 100, 0] }, { duration: 1000 }),
  ".box",
)
```

Offsets default to even distribution. Provide `offsets: [0, 0.3, 1]` to
shape the curve.

## Stagger

Motion:

```js
animate(".item", { opacity: 1 }, { delay: stagger(0.05) })
```

Kinem uses an explicit `stagger()` combinator that takes an array of
definitions, one per target:

```ts
import { play, stagger, tween } from "kinem"

const defs = Array.from({ length: 10 }, () =>
  tween({ opacity: [0, 1] }, { duration: 300 }),
)

play(stagger(defs, { each: 50 }), ".item")
```

Patterns like `{ from: "center" }`, `{ from: "edges" }`, and the
`fromGrid` / `wave` / `shuffle` helpers cover the common Motion
presets.

## Scroll

Motion's `scroll` factory maps to Kinem's `scroll()` helper:

```ts
import { scroll, tween } from "kinem"

scroll(
  tween({ y: [0, -100] }, { duration: 1000 }),
  { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
)
```

## Spring

Motion's `spring()` easing is a direct map:

```ts
import { play, spring, tween } from "kinem"

play(
  tween({ x: [0, 200] }, { easing: spring({ stiffness: 180, damping: 12 }) }),
  ".box",
)
```

Spring easings carry their own duration, so you can omit `duration`
and let the spring decide when it settles.

## Gestures

Motion's `hover` and `press` actions have a partial counterpart in
Kinem's `gesture()` helper, which wires drag and hover through the
same handle API as regular animations.
