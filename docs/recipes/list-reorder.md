# List reorder

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
