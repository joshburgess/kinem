# Shared element transition

Animate an element between two locations in the React tree (think:
thumbnail in a list expanding into a hero on a detail view). Pair
`useLayout` with a shared `LayoutGroup` so the unmount in the list and
the mount in the detail view animate as one.

```tsx
import { useState } from "react"
import { useLayout } from "@kinem/react"
import { createLayoutGroup } from "@kinem/core"

// One group instance shared by every element that participates in
// shared-element transitions. A single process-wide group is fine for
// most apps; create your own when you need isolated TTL or scoping.
const group = createLayoutGroup({ ttl: 400 })

function Thumb({ id, onOpen }: { id: string; onOpen: () => void }) {
  const { ref } = useLayout<HTMLImageElement>({
    duration: 320,
    layoutId: id,
    layoutGroup: group,
  })
  return (
    <img
      ref={ref}
      src={`/photos/${id}.jpg`}
      alt=""
      onClick={onOpen}
      style={{ width: 96, height: 96, borderRadius: 8, cursor: "pointer" }}
    />
  )
}

function Hero({ id, onClose }: { id: string; onClose: () => void }) {
  const { ref } = useLayout<HTMLImageElement>({
    duration: 320,
    layoutId: id,
    layoutGroup: group,
  })
  return (
    <img
      ref={ref}
      src={`/photos/${id}.jpg`}
      alt=""
      onClick={onClose}
      style={{
        position: "fixed",
        inset: "10vh 10vw",
        width: "auto",
        height: "auto",
        borderRadius: 16,
        cursor: "pointer",
      }}
    />
  )
}

export function Gallery() {
  const [openId, setOpenId] = useState<string | null>(null)

  if (openId !== null) {
    return <Hero id={openId} onClose={() => setOpenId(null)} />
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {["alpha", "bravo", "charlie"].map((id) => (
        <Thumb key={id} id={id} onOpen={() => setOpenId(id)} />
      ))}
    </div>
  )
}
```

### How the pairing works

1. The thumbnail unmounts. `useLayout` captures its DOM rect into the
   shared group under key `id`, then drops the element.
2. The hero mounts under the same `layoutId`. `useLayout` consumes the
   captured rect and uses it as the FLIP "first" measurement, with the
   hero's mounted rect as "last", and runs an inverted-then-released
   transform tween between them.
3. Captured rects expire after `ttl` ms. Past that, no animation runs
   and the hero just appears in place.

### Notes

- Both locations must share the exact same `layoutId` and the same
  `LayoutGroup` instance. A common mistake is creating a fresh group
  inside a component (which makes every render a new group); hoist it
  to module scope or wrap it in a stable context.
- `ttl` is the only knob that needs care. Set it as long as the user is
  realistically away from the source view, but short enough that
  navigating back later doesn't trigger a stale-rect animation.
- The hero in the example positions absolutely. For a sheet that pushes
  the rest of the page, the same pattern works as long as the new mount
  point eventually settles to a stable rect.
