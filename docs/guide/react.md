# React

`@kinem/react` is the React adapter. Hooks bind the vanilla `play()` API to
DOM refs. Animations never touch React state during playback, so they don't
trigger re-renders.

## Install

```sh
pnpm add @kinem/react @kinem/core
```

`@kinem/core` is a peer dependency.

## `<Motion>` component

Declarative entry, exit, and value animation that writes directly to the
underlying DOM ref.

```tsx
import { Motion } from "@kinem/react"

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

`<Motion>` accepts a `variants` map of named `MotionValues`. When set, the
`initial`, `animate`, `exit`, `whileHover`, and `whileTap` props can each
be a string key (or array of keys, merged left-to-right) instead of an
inline values object.

```tsx
import { Motion, type Variants } from "@kinem/react"

const drawer: Variants = {
  closed: { x: -240, opacity: 0 },
  open:   { x:    0, opacity: 1 },
}

function Drawer({ open }: { open: boolean }) {
  return (
    <Motion
      variants={drawer}
      initial="closed"
      animate={open ? "open" : "closed"}
      transition={{ duration: 280 }}
    />
  )
}
```

A parent `<Motion>` whose `animate` is a key propagates that key to
descendant `<Motion>` components that have their own `variants` map but
no explicit `animate`. Each descendant resolves the inherited key against
its own variants, so a single parent flip can drive a whole subtree:

```tsx
const card = { closed: { rotate: 0 }, open: { rotate: 8 } }
const dot  = { closed: { scale: 1 }, open: { scale: 1.4 } }

<Motion variants={card} initial="closed" animate={open ? "open" : "closed"}>
  <Motion variants={dot} initial="closed" />
</Motion>
```

### whileHover / whileTap

`whileHover` and `whileTap` give a temporary state override while the
pointer is over (hover) or pressed (tap). Tap takes precedence over hover.

```tsx
<Motion
  variants={{
    rest: { scale: 1 },
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

## `useAnimation`

Imperative control. Attach `ref`, then call `play(def)` from any handler.

```tsx
import { useAnimation } from "@kinem/react"
import { easeOut, tween } from "@kinem/core"

function Toggle() {
  const anim = useAnimation<HTMLDivElement>()
  return (
    <div ref={anim.ref} onClick={() => {
      anim.play(tween({ x: [0, 200] }, { duration: 400, easing: easeOut }))
    }}>
      tap me
    </div>
  )
}
```

The hook cancels any in-flight animation when you call `play` again, and
cancels the current one on unmount.

## `useSpring`

Subscribe to a numeric spring whose target you can set imperatively.

```tsx
import { useSpring } from "@kinem/react"

function Follower({ x }: { x: number }) {
  const spring = useSpring(0, { stiffness: 220, damping: 20 })
  spring.set(x)
  return <div style={{ transform: `translateX(${spring.value}px)` }} />
}
```

## `useGesture`

Adds drag, hover, pan, pinch, press, and tap recognizers to a ref.

```tsx
import { useGesture } from "@kinem/react"

function Draggable() {
  const { ref } = useGesture<HTMLDivElement>({
    drag: { axis: "x", bounds: [-200, 200] },
  })
  return <div ref={ref} className="card" />
}
```

## `useScroll`

Drives a callback or animation as the user scrolls past a trigger.

```tsx
import { useScroll } from "@kinem/react"

function Section() {
  const { ref } = useScroll<HTMLElement>({
    trigger: { start: "top 80%", end: "bottom 20%" },
    onProgress: (p) => console.log(p),
  })
  return <section ref={ref}>scroll me</section>
}
```

## `useLayout` (FLIP)

Animate elements between layout positions automatically. Useful for
re-ordering lists, grid reflows, or expanding panels.

```tsx
import { useLayout } from "@kinem/react"

function Item({ children }: { children: React.ReactNode }) {
  const { ref } = useLayout<HTMLDivElement>({ duration: 300 })
  return <div ref={ref}>{children}</div>
}
```

## `useAnimate`

`useAnimate()` returns a `[scope, animate]` tuple for imperative
animation against elements inside a scoped subtree. Bind `scope` as a
ref and call `animate(target, props, opts)` to tween properties on a CSS
selector resolved within scope, an `Element`, or an `Element[]`.

```tsx
import { useAnimate } from "@kinem/react"

function StaggerIn() {
  const [scope, animate] = useAnimate()
  const onClick = () => animate("li", { opacity: [0, 1], y: [12, 0] }, { duration: 300 })
  return (
    <>
      <ul ref={scope}>
        <li>one</li><li>two</li><li>three</li>
      </ul>
      <button onClick={onClick}>play</button>
    </>
  )
}
```

The returned `Controls` is the same handle `play()` produces, so you can
`await controls.finished`, cancel, pause, or scrub.

## `useTime`, `useVelocity`, `useMotionValueEvent`

Reactive value plumbing. `useTime()` returns a self-driving
`MotionValue<number>` of milliseconds since mount; it auto-starts an rAF
loop on the first listener and stops on the last. `useVelocity(source)`
derives a per-second derivative `MotionValue` from any source.
`useMotionValueEvent(mv, "change", listener)` is a small subscription
wrapper that re-binds the listener if it changes.

```tsx
import { useEffect, useState } from "react"
import { useMotionValueEvent, useTime, useVelocity } from "@kinem/react"

function Clock() {
  const t = useTime()
  const vt = useVelocity(t)
  const [text, setText] = useState("0")
  useMotionValueEvent(t, "change", (ms) => setText(ms.toFixed(0)))
  useEffect(() => () => { t.destroy(); vt.destroy() }, [t, vt])
  return <span>{text} ms</span>
}
```

## `<Reorder.Group>` / `<Reorder.Item>`

Drag-to-sort lists. The group owns the `values` array and the
`onReorder` callback. Each item registers itself with the group, becomes
draggable along the group's `axis`, and asks the group to commit a new
order whenever the dragged item's center crosses a neighbour's. Sibling
items translate to make room mid-drag and clear on pointer release.

```tsx
import { useState } from "react"
import { Reorder } from "@kinem/react"

function Todo() {
  const [items, setItems] = useState(["read", "write", "ship"])
  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems}>
      {items.map((v) => (
        <Reorder.Item key={v} value={v}>{v}</Reorder.Item>
      ))}
    </Reorder.Group>
  )
}
```

`axis` defaults to `"y"`; pass `"x"` for horizontal lists. Items render
as `<li>` by default; override with `as="div"` (or any tag).

## `useReducedMotion`

Reactive boolean tied to the OS's `prefers-reduced-motion` setting plus any
`setReducedMotionDefault()` override from the core package.

```tsx
import { useReducedMotion } from "@kinem/react"

function Hero() {
  const reduce = useReducedMotion()
  return reduce ? <Static /> : <Animated />
}
```

## `<AnimatePresence>`

Animates children in and out around React's mount and unmount. Pair with
`<Motion>` to declare exit animations.

```tsx
import { AnimatePresence, Motion } from "@kinem/react"

function Toast({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <Motion
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 200 }}
        >
          saved
        </Motion>
      )}
    </AnimatePresence>
  )
}
```

## SSR

Every hook short-circuits during server render and starts on first commit.
No additional setup required.
