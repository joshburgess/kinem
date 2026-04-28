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
- `useReducedMotion`, `prefersReducedMotion`
- `<Motion>` and `<AnimatePresence>` components

## Docs

Full guide and API reference in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
