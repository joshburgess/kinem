# @kinem/react

React bindings for [kinem](https://github.com/joshburgess/kinem). Hooks and
components that wrap the vanilla `play()`, gesture, and scroll APIs.
Animations run against DOM refs via WAAPI or rAF; React state is never
touched during playback, so animations do not drive re-renders.

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

## Install

```sh
pnpm add @kinem/react @kinem/core
```

`@kinem/core` is a peer dependency.

## What's exported

- `useAnimation`, `useGesture`, `useLayout`, `useScroll`, `useSpring` hooks
- `useTime`, `useVelocity`, `useMotionValueEvent` for reactive value plumbing
- `useAnimate` for imperative `animate(target, props, opts)` calls scoped to a ref
- `useReducedMotion`, `prefersReducedMotion`
- `<Motion>` and `<AnimatePresence>` components
- `Reorder.Group` and `Reorder.Item` for drag-to-sort lists

```tsx
import { useAnimate, useTime, useVelocity, Reorder } from "@kinem/react"

function StaggerIn() {
  const [scope, animate] = useAnimate()
  return (
    <ul ref={scope}>
      {items.map((i) => <li key={i.id}>{i.label}</li>)}
      <button onClick={() => animate("li", { opacity: [0, 1] }, { duration: 300 })}>
        play
      </button>
    </ul>
  )
}
```

## Docs

Full guide and API reference in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
