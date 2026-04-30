# @kinem/solid

Solid bindings for [kinem](https://github.com/joshburgess/kinem). Primitives
and a `<Motion>` component that wrap the vanilla `play()`, gesture, and
scroll APIs. Animations run against DOM refs via WAAPI or rAF; Solid
signals are never written during playback, so animations do not trigger
reactivity churn.

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

## Install

```sh
pnpm add @kinem/solid @kinem/core
```

`@kinem/core` is a peer dependency.

## What's exported

- `createAnimation`, `createGesture`, `createLayout`, `createScroll`, `createSpring` primitives
- `createTime`, `createVelocity`, `createMotionValueEvent` for reactive value plumbing
- `createAnimate` for imperative `animate(target, props, opts)` calls scoped to a ref
- `createReducedMotion`, `prefersReducedMotion`
- `<Motion>` component
- `<ReorderGroup>` and `<ReorderItem>` for drag-to-sort lists

```tsx
import { createSignal, For } from "solid-js"
import { createAnimate } from "@kinem/solid"

function StaggerIn() {
  const [items] = createSignal([{ id: 1, label: "one" }, { id: 2, label: "two" }])
  const { scope, animate } = createAnimate()
  return (
    <>
      <ul ref={scope}>
        <For each={items()}>{(i) => <li>{i.label}</li>}</For>
      </ul>
      <button onClick={() => animate("li", { opacity: [0, 1] }, { duration: 300 })}>
        play
      </button>
    </>
  )
}
```

## Docs

Full guide and API reference in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
