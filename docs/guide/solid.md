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

## `createAnimate`

`createAnimate()` returns `{ scope, animate }` for imperative animation
against elements inside a scoped subtree. `scope` is a Solid ref setter;
call `animate(target, props, opts)` to tween properties on a CSS
selector resolved within scope, an `Element`, or an `Element[]`.

```tsx
import { For } from "solid-js"
import { createAnimate } from "@kinem/solid"

function StaggerIn() {
  const items = ["one", "two", "three"]
  const { scope, animate } = createAnimate()
  const onClick = () =>
    animate("li", { opacity: [0, 1], y: [12, 0] }, { duration: 300 })
  return (
    <>
      <ul ref={scope}>
        <For each={items}>{(i) => <li>{i}</li>}</For>
      </ul>
      <button onClick={onClick}>play</button>
    </>
  )
}
```

The returned `Controls` is the same handle `play()` produces, so you can
`await controls.finished`, cancel, pause, or scrub.

## `createTime`, `createVelocity`, `createMotionValueEvent`

Reactive value plumbing. `createTime()` returns a self-driving
`MotionValue<number>` of milliseconds since mount. `createVelocity(source)`
derives a per-second derivative `MotionValue` from any source.
`createMotionValueEvent(mv, "change", listener)` re-binds the listener
if it changes; the subscription is cleaned up on `onCleanup`.

```tsx
import { createSignal } from "solid-js"
import { createMotionValueEvent, createTime } from "@kinem/solid"

function Clock() {
  const t = createTime()
  const [text, setText] = createSignal("0")
  createMotionValueEvent(t, "change", (ms) => setText(ms.toFixed(0)))
  return <span>{text()} ms</span>
}
```

## `<ReorderGroup>` / `<ReorderItem>`

Drag-to-sort lists. The group owns the `values` array and the
`onReorder` callback. Each item registers itself with the group, becomes
draggable along the group's `axis`, and asks the group to commit a new
order whenever the dragged item's center crosses a neighbour's. Sibling
items translate to make room mid-drag and clear on pointer release.

```tsx
import { For, createSignal } from "solid-js"
import { ReorderGroup, ReorderItem } from "@kinem/solid"

function Todo() {
  const [items, setItems] = createSignal(["read", "write", "ship"])
  return (
    <ReorderGroup axis="y" values={items()} onReorder={setItems}>
      <For each={items()}>{(v) => (
        <ReorderItem value={v}>{v}</ReorderItem>
      )}</For>
    </ReorderGroup>
  )
}
```

`axis` defaults to `"y"`; pass `"x"` for horizontal lists. Group renders
as `<ul>` and item as `<li>` by default; override via the `as` prop.

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
