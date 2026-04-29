# Solid

`@kinem/solid` is the Solid adapter. Primitives (`create*`) bind the
vanilla `play()` API to refs. Solid signals are never written during
playback, so animations don't trigger reactivity churn.

## Install

```sh
pnpm add @kinem/solid @kinem/core
```

`@kinem/core` and `solid-js@>=1.8` are peer dependencies.

## `<Motion>` component

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

### Variants

`<Motion>` accepts a `variants` map of named `MotionValues`. When set,
`initial`, `animate`, `exit`, `whileHover`, and `whileTap` can each be a
string key (or array of keys, merged left-to-right) instead of an inline
values object.

```tsx
import { createSignal } from "solid-js"
import { Motion, type Variants } from "@kinem/solid"

const drawer: Variants = {
  closed: { x: -240, opacity: 0 },
  open:   { x:    0, opacity: 1 },
}

function Drawer() {
  const [open, setOpen] = createSignal(false)
  return (
    <Motion
      variants={drawer}
      initial="closed"
      animate={open() ? "open" : "closed"}
      transition={{ duration: 280 }}
    />
  )
}
```

A parent `<Motion>` whose `animate` is a key propagates that key to
descendants that have their own `variants` map but no explicit `animate`.

### whileHover / whileTap

`whileHover` and `whileTap` give a temporary state override while the
pointer is over (hover) or pressed (tap). Tap takes precedence over hover.

```tsx
<Motion
  variants={{
    rest:  { scale: 1 },
    hover: { scale: 1.05 },
    press: { scale: 0.95 },
  }}
  initial="rest"
  animate="rest"
  whileHover="hover"
  whileTap="press"
  transition={{ duration: 120 }}
/>
```

## `createAnimation`

Imperative control. Attach `ref`, then call `play(def)` from any handler.

```tsx
import { createAnimation } from "@kinem/solid"
import { easeOut, tween } from "@kinem/core"

function Toggle() {
  const anim = createAnimation<HTMLDivElement>()
  return (
    <div
      ref={anim.ref}
      onClick={() => {
        anim.play(tween({ x: [0, 200] }, { duration: 400, easing: easeOut }))
      }}
    >
      tap me
    </div>
  )
}
```

`anim.play` cancels any in-flight animation. The primitive cancels the
current one on cleanup.

## `createSpring`

```tsx
import { createSpring } from "@kinem/solid"

function Follower(props: { x: number }) {
  const spring = createSpring(0, { stiffness: 220, damping: 20 })
  spring.set(props.x)
  return <div style={{ transform: `translateX(${spring.value()}px)` }} />
}
```

## `createGesture`

```tsx
import { createGesture } from "@kinem/solid"

function Draggable() {
  const { ref } = createGesture<HTMLDivElement>({
    drag: { axis: "x", bounds: [-200, 200] },
  })
  return <div ref={ref} class="card" />
}
```

## `createScroll`

```tsx
import { createScroll } from "@kinem/solid"

function Section() {
  const { ref } = createScroll<HTMLElement>({
    trigger: { start: "top 80%", end: "bottom 20%" },
    onProgress: (p) => console.log(p),
  })
  return <section ref={ref}>scroll me</section>
}
```

## `createLayout` (FLIP)

```tsx
import { createLayout } from "@kinem/solid"

function Item(props: { children: any }) {
  const { ref } = createLayout<HTMLDivElement>({ duration: 300 })
  return <div ref={ref}>{props.children}</div>
}
```

## `createPresence`

Solid's adapter pairs `<Show>` with a `createPresence` controller. Pass
the controller into `<Motion presence={...}>` so it can play its `exit`
tween before unmount.

```tsx
import { Show, createSignal } from "solid-js"
import { Motion, createPresence } from "@kinem/solid"

function Toast() {
  const [open, setOpen] = createSignal(false)
  const presence = createPresence(open)
  return (
    <Show when={presence.shouldRender()}>
      <Motion
        presence={presence}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 200 }}
      >
        saved
      </Motion>
    </Show>
  )
}
```

## `createReducedMotion`

Reactive boolean tied to the OS's `prefers-reduced-motion` setting plus
any `setReducedMotionDefault()` override from the core package.

```tsx
import { createReducedMotion } from "@kinem/solid"

function Hero() {
  const reduce = createReducedMotion()
  return reduce() ? <Static /> : <Animated />
}
```

## SSR

Every primitive defers DOM access until `onMount`, so server render is a
no-op. Nothing to configure.
