# Reactive values

Use `motionValue`, `time`, `velocity`, `transform`, `combine`, and
`inView` to build animation graphs that don't go through `play()` or any
framework adapter. These primitives are the imperative substrate every
adapter sits on top of, and they're useful on their own when you want
direct control over a tick loop or a reactive cell.

## A reactive cell

`motionValue` is a tiny reactive cell. It holds a value, fires
listeners on change, and tracks velocity over a short window so callers
can derive throw-on-release behavior without bookkeeping.

```ts
import { motionValue } from "@kinem/core"

const x = motionValue(0)
x.on((value, prev) => {
  console.log(`${prev} -> ${value}`)
})
x.set(100) // listener: 0 -> 100
x.set(100) // no-op: Object.is equality
```

`set` only notifies when the value actually changes, so high-frequency
inputs (drag, scroll, raf) are safe to feed in directly.

## A heartbeat

`time()` returns a `MotionValue<number>` that ticks every animation
frame, holding ms since the cell was created. It only runs the rAF loop
while it has subscribers, so a `time()` you create but never `.on()` is
free.

```ts
import { time } from "@kinem/core"

const t = time()
const off = t.on((ms) => {
  el.style.opacity = String(0.5 + 0.5 * Math.sin(ms / 600))
})
// later:
off()
t.destroy()
```

A single `time()` cell can drive every animation in a view; subscribing
five rows fans out into five callbacks per tick rather than five raf
loops.

## Velocity

`velocity(source)` mirrors the source's per-second derivative as a
`MotionValue<number>`. It updates whenever the source updates and decays
to 0 within ~30 ms of the last `set`, so it's a clean signal for
spring-on-release without sampling errors from stale frames.

```ts
import { motionValue, velocity } from "@kinem/core"

const x = motionValue(0)
const vx = velocity(x)

// drag handler:
const onMove = (clientX: number) => x.set(clientX)
const onUp   = () => spring({ x: 0 }, [el], { velocity: vx.get() })
```

## Mapping with transform

`transform(input, output)` returns a pure mapper. Pass any number
through it and get the corresponding output. Combine with `motionValue`
or `time` by wiring the mapping in a listener.

```ts
import { motionValue, transform } from "@kinem/core"

const scroll = motionValue(0)
const opacity = transform([0, 200], [0, 1])

scroll.on((y) => {
  el.style.opacity = String(opacity(y))
})
```

The mapper is allocation-free per call, so it's safe inside a rAF loop.
For multi-stop ranges, pass aligned arrays:

```ts
const fade = transform([0, 100, 200], [0, 1, 0])
fade(50)  // 0.5
fade(150) // 0.5
```

## Composing sources with combine

`combine(sources, fn)` derives a new `MotionValue` from any set of
sources. The derived cell updates whenever any source updates and
inherits the same equality semantics as `motionValue` (no notification
when `fn` returns an `Object.is`-equal value).

```ts
import { combine, motionValue } from "@kinem/core"

const x = motionValue(0)
const y = motionValue(0)
const dist = combine([x, y], (a, b) => Math.hypot(a, b))

dist.on((d) => {
  badge.textContent = d.toFixed(1)
})

x.set(3); y.set(4) // badge: "5.0"
```

Use it to fold pointer position, scroll offset, and a time tick into a
single value the renderer subscribes to once.

## Reacting to viewport

`inView(el, enter, opts?)` wraps `IntersectionObserver`. The `enter`
callback may return a `leave` function that fires the next time the
element exits, so reveal-and-undo is one call.

```ts
import { inView, play, tween } from "@kinem/core"

const fadeIn  = tween({ opacity: [0, 1] }, { duration: 360 })
const fadeOut = tween({ opacity: [1, 0] }, { duration: 220 })

const stop = inView(el, () => {
  play(fadeIn, [el])
  return () => {
    play(fadeOut, [el])
  }
})
```

Pass `{ once: true }` for a one-shot reveal that disconnects after the
first fire. `rootMargin: "0px 0px -25% 0px"` triggers reveals before the
target reaches the bottom of the viewport, useful for lists where a
hard hit looks late.

## Putting it together

A typical pattern: one `time()` heartbeat, one `motionValue` per input,
a `combine` to fold them, and DOM writes inside a single subscription.

```ts
import { combine, motionValue, time, transform } from "@kinem/core"

const t = time()
const cursor = motionValue({ x: 0.5, y: 0.5 })

const wave = transform([0, 1], [-1, 1])

const tilt = combine([t, cursor], (ms, c) => ({
  rotX: wave(c.y) * 12,
  rotY: wave(c.x) * 12,
  shimmer: 0.5 + 0.5 * Math.sin(ms / 800),
}))

const off = tilt.on(({ rotX, rotY, shimmer }) => {
  card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`
  card.style.setProperty("--shimmer", String(shimmer))
})

window.addEventListener("pointermove", (e) => {
  cursor.set({
    x: e.clientX / window.innerWidth,
    y: e.clientY / window.innerHeight,
  })
})

// teardown
off()
tilt.destroy()
cursor.destroy()
t.destroy()
```

Three sources, one derived cell, one DOM write. The same pattern scales
to a grid of cards: keep the sources global and create one `combine`
per cell.

## Cleanup

Every subscription returns an unsubscribe; every cell has a `destroy()`
that clears local listeners. Derived cells (`velocity`, `combine`) also
unsubscribe from their sources on `destroy`, so a single teardown call
releases the graph.

```ts
const offs: Array<() => void> = []
offs.push(t.on(handleTick))
offs.push(cursor.on(handlePointer))

return () => {
  for (const off of offs) off()
  tilt.destroy()
  cursor.destroy()
  t.destroy()
}
```

For ambient registrations in devtools, `trackNamed("my-feature")`
returns its own off function. Wire it into the same teardown path so
cancelled features disappear from the live list immediately.
