# Page transitions

Cross-fade or slide between routes. The example uses React Router but
the pattern applies to any router that gives you the current path: key
the animated wrapper by the path so `<AnimatePresence>` sees a fresh
node on every navigation.

```tsx
import { useLocation, useRoutes } from "react-router-dom"
import { AnimatePresence, Motion, type Variants } from "@kinem/react"

const page: Variants = {
  initial: { opacity: 0, y: 12 },
  enter:   { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 },
}

export function App() {
  const location = useLocation()
  const element = useRoutes([
    { path: "/", element: <Home /> },
    { path: "/about", element: <About /> },
  ])

  return (
    <AnimatePresence>
      <Motion
        key={location.pathname}
        variants={page}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={{ duration: 240 }}
        style={{ minHeight: "100vh" }}
      >
        {element}
      </Motion>
    </AnimatePresence>
  )
}
```

### Sliding by direction

If you want forward / backward navigation to slide in opposite
directions, look at `history.action` (PUSH vs POP) and switch variants
accordingly:

```tsx
const history = useHistory()
const direction = history.action === "POP" ? -1 : 1

const slide: Variants = {
  initial: { x: 100 * direction, opacity: 0 },
  enter:   { x: 0,                opacity: 1 },
  exit:    { x: -100 * direction, opacity: 0 },
}
```

### Notes

- The `key={location.pathname}` is load-bearing. Without it React reuses
  the same `<Motion>` element across navigations and `<AnimatePresence>`
  has no unmount to play `exit` against.
- Each animated page becomes a positioning context during the
  transition. If both the old and new page are absolutely positioned
  inside a container, you'll get a smooth crossfade. If they share
  document flow, expect a moment where both are present at once.
- For native browser navigation use `view-transition` (kinem exports a
  `playViewTransition()` helper that wraps the platform API where
  available).
