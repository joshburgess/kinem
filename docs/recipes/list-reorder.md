# List reorder

Two patterns share this page: a FLIP animation when an underlying list
shuffles (no user interaction), and a drag-to-sort component built on
the shared `createReorderController` engine.

## Shuffle-driven (FLIP)

Animate items between positions when an underlying list shuffles. Uses
`useLayout` to capture each item's pre-mutation rect, then run the FLIP
animation once React commits the new order.

```tsx
import { useState } from "react"
import { useLayout } from "@kinem/react"

interface Item {
  readonly id: string
  readonly label: string
}

function Row({ item }: { item: Item }) {
  // The same `layoutId` (here: the item's id) lets useLayout pair an
  // unmount in one place with a mount in another and animate between
  // them. For a simple in-place reorder, omitting layoutId works too;
  // FLIP will animate via the per-element ref.
  const { ref } = useLayout<HTMLLIElement>({
    duration: 320,
    layoutId: item.id,
  })
  return (
    <li
      ref={ref}
      style={{
        listStyle: "none",
        padding: "12px 16px",
        marginBottom: 8,
        borderRadius: 8,
        background: "white",
      }}
    >
      {item.label}
    </li>
  )
}

export function ReorderList() {
  const [items, setItems] = useState<readonly Item[]>([
    { id: "a", label: "Alpha" },
    { id: "b", label: "Bravo" },
    { id: "c", label: "Charlie" },
    { id: "d", label: "Delta" },
  ])

  const shuffle = () => {
    setItems((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = next[i]
        next[i] = next[j]
        next[j] = tmp
      }
      return next
    })
  }

  return (
    <>
      <button type="button" onClick={shuffle}>shuffle</button>
      <ul style={{ padding: 0 }}>
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </>
  )
}
```

### Notes

- Always key items by a stable identifier (the item's `id`), not the
  array index. FLIP relies on React keeping the same DOM node attached
  to the same React element across the reorder.
- `useLayout` measures the rect on every render before commit and runs a
  transform tween from the previous rect to the new one. The tween
  cancels itself on unmount, so a removed item simply disappears.
- To animate add/remove at the same time, wrap the list in
  `<AnimatePresence>` and add a `<Motion>` wrapper inside `Row` with
  `initial` / `exit` set on it.

## Drag-to-sort

When the user drives the order with a pointer, use the framework
adapter's Reorder API. The group owns the `values` array and an
`onReorder` callback; each item registers with the group, becomes
draggable along `axis`, and asks the group to commit a new order
whenever the dragged item's center crosses a neighbour's. Sibling items
translate to make room mid-drag and clear on pointer release.

All four adapters share the same `createReorderController` engine in
`@kinem/core`, so the pointer math, sibling translates, and commit
behaviour stay identical across frameworks.

### React

```tsx
import { useState } from "react"
import { Reorder } from "@kinem/react"

export function Todo() {
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

### Vue

```vue
<script setup lang="ts">
import { ref } from "vue"
import { ReorderGroup, ReorderItem } from "@kinem/vue"

const items = ref(["read", "write", "ship"])
</script>

<template>
  <ReorderGroup axis="y" :values="items" :onReorder="(n) => (items = n)">
    <ReorderItem v-for="v in items" :key="v" :value="v">{{ v }}</ReorderItem>
  </ReorderGroup>
</template>
```

### Solid

```tsx
import { For, createSignal } from "solid-js"
import { ReorderGroup, ReorderItem } from "@kinem/solid"

export function Todo() {
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

### Svelte

```svelte
<script lang="ts">
  import { reorderGroup, reorderItem } from "@kinem/svelte"

  let items = $state(["read", "write", "ship"])
</script>

<ul use:reorderGroup={{ values: items, onReorder: (n) => items = n }}>
  {#each items as v (v)}
    <li use:reorderItem={{ value: v }}>{v}</li>
  {/each}
</ul>
```

### Notes

- `axis` defaults to `"y"`; pass `"x"` for horizontal lists. The item's
  `touch-action` is set to allow the cross-axis pan automatically.
- The group renders as `<ul>` and items as `<li>` by default. Override
  via the `as` prop (React, Vue, Solid) or by attaching the action to
  any element (Svelte).
- For Svelte, the parent `use:reorderGroup` MUST be attached before the
  child `use:reorderItem` actions mount. Svelte's natural mount order
  (parent before children) makes this the default.
- The dragged item is positioned via `transform: translate3d(...)` and
  the others get `transform` shifts that clear on pointer release. The
  underlying array order only changes when the order genuinely changes,
  so re-renders stay minimal.
