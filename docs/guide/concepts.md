<script setup>
const staggerCode = `const boxes = Array.from({ length: 6 }, (_, i) => {
  const el = document.createElement('div')
  el.className = 'box'
  el.style.left = (40 + i * 56) + 'px'
  el.style.top = '50%'
  el.style.transform = 'translateY(-50%)'
  stage.appendChild(el)
  return el
})

play(
  stagger(
    boxes.map(() =>
      sequence(
        tween({ y: [0, -40] }, { duration: 300, easing: easeOut }),
        tween({ y: [-40, 0] }, { duration: 300, easing: easeIn }),
      ),
    ),
    { each: 80 },
  ),
  boxes,
)`
</script>

# Core concepts

## AnimationDef

Every animation in Kinem is an `AnimationDef`: a plain object with three fields.

```ts
interface AnimationDef<V> {
  readonly duration: number
  readonly easing: EasingFn
  readonly interpolate: (progress: number) => V
}
```

- `duration` is a length in milliseconds.
- `easing` is a `(p: number) => number` mapping, already applied inside
  `interpolate`. Renderers do not re-apply it.
- `interpolate(progress)` samples the animation. Progress is clamped to
  `[0, 1]`.

Because `AnimationDef` is a plain value, you can sample, inspect, and
test it without any runtime. There is no hidden state, no timer, no DOM.

## Easings

Built-in easings (`linear`, `easeIn`, `easeOut`, `easeInOut`) are the
usual cubic approximations. `cubicBezier(x1, y1, x2, y2)` returns a
custom curve. `steps(n)` returns a stepped easing. Spring easings
(`springEasing({ stiffness, damping, mass })`) are duration-carrying:
passing one as `easing` lets the spring choose the duration for you.

## Renderers

Renderers are functions that take an `AnimationDef` and a target and
return a handle. They share a common `Controls`-like surface:

- `play()` is the high-level entry. It resolves selectors, auto-picks
  the rendering backend (WAAPI vs rAF), and tracks the animation with
  devtools.
- `playWaapi()` / `playRaf()` are the backend-specific variants.
- `playCanvas()` runs a commit callback on every frame, passing the
  interpolated value.
- `playUniforms()` commits animated values to WebGL uniforms.

## Composition

Composition is function-to-function. Combinators accept one or more
`AnimationDef`s and return a new one.

- `parallel(a, b, ...)` plays children simultaneously. Duration is the
  max of children.
- `sequence(a, b, ...)` plays children back to back. Duration is the
  sum.
- `stagger(defs, { each, from })` plays an array of definitions with
  per-index offsets.
- `map(def, fn)` transforms the interpolated value.
- `loop(def, { count, reverse })` repeats an animation.
- `reverse(def)` swaps the direction.
- `delay(def, ms)` adds leading padding.

<Playground :code="staggerCode" height="180px" />

## Timelines

When you need positional control (overlapping offsets, labels, gaps),
`timeline()` is the imperative sibling of `sequence`/`parallel`:

```ts
import { easeOut, timeline, tween } from "@kinem/core"

const tl = timeline()
  .add(tween({ opacity: [0, 1] }, { duration: 300 }), 0)
  .add(tween({ y: [20, 0] }, { duration: 300, easing: easeOut }), "-=100")
  .label("midpoint")
  .add(tween({ scale: [1, 1.05] }, { duration: 200 }), "midpoint")

play(tl.def, ".card")
```
