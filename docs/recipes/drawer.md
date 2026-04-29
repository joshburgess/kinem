# Drawer / sheet

Slide a panel in from the edge of the viewport, with a backdrop that
fades in and a trigger that lifts on hover.

```tsx
import { useState } from "react"
import { AnimatePresence, Motion, type Variants } from "@kinem/react"

const drawer: Variants = {
  closed: { x: -320, opacity: 0 },
  open:   { x:    0, opacity: 1 },
}

const backdrop: Variants = {
  closed: { opacity: 0 },
  open:   { opacity: 0.5 },
}

const trigger: Variants = {
  rest:  { scale: 1 },
  hover: { scale: 1.04 },
  press: { scale: 0.96 },
}

export function Drawer() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Motion
        as="button"
        type="button"
        variants={trigger}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileTap="press"
        transition={{ duration: 120 }}
        onClick={() => setOpen(true)}
      >
        Open menu
      </Motion>

      <AnimatePresence>
        {open && (
          <Motion
            key="backdrop"
            variants={backdrop}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ duration: 200 }}
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "black",
            }}
          />
        )}
        {open && (
          <Motion
            key="panel"
            as="aside"
            variants={drawer}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ duration: 280 }}
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
              width: 320,
              background: "white",
            }}
          >
            menu content
          </Motion>
        )}
      </AnimatePresence>
    </>
  )
}
```

### Notes

- Both children of `<AnimatePresence>` carry stable `key` props so the
  presence machinery can detect when each leaves and play its `exit`.
- The trigger uses three named variants (`rest`, `hover`, `press`) to
  keep the resting baseline explicit. `whileTap` takes precedence over
  `whileHover`, so a press while hovering scales down.
- Manage focus and `aria-expanded` on the trigger yourself. Kinem stays
  out of accessibility decisions; an opened drawer should usually trap
  focus and restore it on close.
