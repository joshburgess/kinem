# Renderer modes

Every `play()` call has to answer one question before it does anything
else: where does the *timing* run? On the GPU's compositor, or in
JavaScript on the main thread? The answer is what the `mode` option
picks, and it has real consequences for startup cost, jank resilience,
and what kind of properties you can animate.

This page walks through the three modes, when to pick each one, and
how `mode` relates to the lower-level `backend` option.

## What "timing" means here

Three things happen on every animated frame:

1. **Timing**: read the clock, compute progress, sample the easing,
   produce the next value.
2. **Paint**: turn the new value into pixels in a layer.
3. **Composite**: combine layers into the final framebuffer the screen
   shows.

Paint and composite are GPU-accelerated regardless of mode. The only
thing the mode picks is *where step 1 runs*: in JS on the main thread,
or inside the browser's compositor (via `Element.animate()` and a
keyframes array we hand off once at startup).

That distinction matters because the main thread can be blocked. A
heavy React render, a long task in a third-party script, a synchronous
layout in your own code: all of those stall any timing that runs in
JS. Compositor-driven timing keeps advancing because the compositor
runs in its own thread.

## The three modes

### `"compositor"`

```ts
play(entrance, ".card", { mode: "compositor" })
```

Hands the animation off to `Element.animate()`. We sample the easing
once at startup, build a keyframes array, and let the compositor tick
the animation from there.

- Resilient to main-thread jank. The animation keeps running smoothly
  even if your app is mid-render or doing a long task.
- Higher startup cost. Sampling the easing and constructing the
  keyframes list isn't free; for short or constantly-cancelled
  animations the setup can be most of the cost.
- Limited to properties the compositor knows how to animate.
  Non-compositor properties throw if you ask for `mode: "compositor"`
  explicitly.

### `"main"`

```ts
play(hover, ".btn", { mode: "main" })
```

Ticks the animation per frame from JavaScript on the main thread,
writing the current value to `element.style` (or to a callback for
`playValues`). No keyframes, no compositor handoff.

- Setup is essentially free. Just object allocation; cancel before
  the first frame is the cheapest path in the library.
- Works with any property, animatable or not (since you write the
  value yourself, the compositor never has to know).
- Pauses if the main thread blocks. If your app freezes for 200 ms,
  so does the animation.

This is the right pick for hover micro-interactions, rapid toggles,
press feedback, anywhere startup latency dominates and the animation
is short enough that main-thread blocking would be visible anyway.

### `"auto"` (default)

```ts
play(entrance, ".card") // mode: "auto" implied
```

Looks at every property the animation touches and routes the
compositor-safe ones through `"compositor"`, the rest through
`"main"`. A single play that animates `opacity` and `borderRadius`
will run two backends in lockstep: WAAPI for opacity, rAF for
border-radius.

This is the right default. It pays the compositor setup cost only
for the properties that benefit from it, and it never makes a
property unanimatable.

## When to pick which

| Situation | Mode |
| --- | --- |
| Hover, press, focus micro-interactions | `"main"` |
| Rapid toggle (menu open/close, tooltip) | `"main"` |
| Entrance / exit, "set it and forget it" | `"auto"` |
| Anything driven by user input (drag, scroll) | `"auto"` |
| Ambient looping animation (spinner, pulse) | `"compositor"` |
| Long-running animation that must survive jank | `"compositor"` |
| Animating a property the compositor doesn't know | `"main"` (or `"auto"`) |
| Throughput on N×1000 elements at startup | `"main"` |
| Don't know yet | `"auto"` |

A useful shortcut: if you'd be unhappy when the animation hitches
because the main thread is busy, you want `"compositor"` (or `"auto"`,
which gets you compositor for the properties that support it). If
startup latency is the thing you'd notice first, you want `"main"`.

## Compositor-safe properties

Auto mode routes these properties through the compositor:

- `opacity`
- `transform`
- `filter`
- `backdropFilter`
- `clipPath`
- `backgroundColor`

Plus the convenience pseudo-properties that compose into `transform`:
`x`, `y`, `z`, `translateX/Y/Z`, `scale`, `scaleX/Y/Z`, `rotate`,
`rotateX/Y/Z`, `skew`, `skewX/Y`.

Everything else (width, height, top, left, color, border-radius, SVG
attributes, anything custom) routes to main. That isn't a slow path
in the modern compositor sense, just one where timing happens in JS.

You can check ahead of time:

```ts
import { isCompositorSafe } from "@kinem/core"

isCompositorSafe("opacity") // true
isCompositorSafe("borderRadius") // false
```

## `mode` vs `backend`

`mode` is the user-facing knob. Underneath it there's a lower-level
`backend` option that maps to the actual renderer:

| `mode` | `backend` | Renderer |
| --- | --- | --- |
| `"compositor"` | `"waapi"` | `playWaapi` (Web Animations API) |
| `"main"` | `"raf"` | `playRaf` (per-frame JS via rAF) |
| `"auto"` | `"auto"` | partition + run both, in lockstep |

You almost never need `backend` directly. It exists for two cases:

1. You want to bypass the partition logic entirely (`backend: "raf"`
   forces rAF for every property, even compositor-safe ones).
2. You're calling a lower-level renderer like `playWaapi` or `playRaf`
   directly and the `backend` field is the only knob.

If both are passed, `backend` wins.

## Performance

Real-browser benchmark numbers and the methodology behind them live
in [`benchmarks/browser/README.md`](https://github.com/joshburgess/kinem/blob/main/benchmarks/browser/README.md).
Headline at n=1000 elements:

- `"main"` is fastest on every scenario: ~5x faster startup than
  GSAP, fastest steady-state, cheapest cancel-before-first.
- `"auto"` pays a small startup cost in exchange for compositor-driven
  ticking. Cancel-before-first stays around 0.6 ms; motion is 4.5 ms
  in the same harness because it sets up WAAPI before it can tear down.
- The setup cost difference between `"main"` and `"compositor"` mostly
  shows up at startup. Once an animation is running, both are cheap.

Reproduce with:

```sh
pnpm -C benchmarks/browser bench:compare --n 1000 --samples 5
```

## Common gotchas

- **Mixing modes on the same element.** `play()` does this for you
  (auto mode partitions by property and runs both backends in
  lockstep), but if you author two separate `play()` calls against
  the same element with different modes, they run as independent
  animations. That's usually fine, occasionally surprising.
- **Compositor with non-compositor properties.** Asking explicitly
  for `mode: "compositor"` while animating a main-thread property
  throws. Use `"auto"` if you want the partition; use `"main"` if
  you know everything routes there.
- **Long values that change layout.** Animating `width` or `height`
  is always main-thread regardless of mode, because changing layout
  invalidates the compositor's cached geometry. If smoothness on a
  size change matters more than the literal pixel size, animate
  `transform: scale()` and accept the visual approximation.
