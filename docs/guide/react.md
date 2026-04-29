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
