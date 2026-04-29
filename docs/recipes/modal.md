# Modal with backdrop

A centered modal panel with a fading backdrop. Click the backdrop or
press Escape to close.

```tsx
import { useEffect, useState } from "react"
import { AnimatePresence, Motion, type Variants } from "@kinem/react"

const backdrop: Variants = {
  closed: { opacity: 0 },
  open:   { opacity: 0.5 },
}

const panel: Variants = {
  closed: { opacity: 0, scale: 0.92 },
  open:   { opacity: 1, scale: 1 },
}

export function Modal({ open, onClose, children }: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <Motion
          key="backdrop"
          variants={backdrop}
          initial="closed"
          animate="open"
          exit="closed"
          transition={{ duration: 180 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "black",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Motion
            key="panel"
            variants={panel}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ duration: 220 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              minWidth: 320,
              maxWidth: 560,
              padding: 24,
              borderRadius: 12,
              background: "white",
            }}
          >
            {children}
          </Motion>
        </Motion>
      )}
    </AnimatePresence>
  )
}
```

### Notes

- The panel is rendered inside the backdrop so a single `<AnimatePresence>`
  can drive both. `e.stopPropagation()` on the panel keeps backdrop
  clicks from bubbling up through it.
- Kinem doesn't provide focus management. For a real production modal
  pair this with a focus-trap library and set `aria-modal="true"`.
- The `scale` value relies on the WAAPI / rAF backend's transform
  interpolation, which composes with the panel's existing transform.
  Avoid setting `transform` on the panel via inline `style` if you want
  the variant value to win.
