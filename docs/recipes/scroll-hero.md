# Scroll-driven hero

Tie a hero element's transform to scroll progress, so it parallaxes and
fades as the section moves through the viewport.

```tsx
import { useRef } from "react"
import { useScroll } from "@kinem/react"

export function Hero() {
  const titleRef = useRef<HTMLHeadingElement>(null)

  // useScroll calls onProgress with a number in [0, 1] as the trigger
  // element moves through the start / end window. We never set React
  // state here; we mutate the title's inline style directly.
  const { ref } = useScroll<HTMLElement>({
    trigger: { start: "top 100%", end: "bottom 0%" },
    onProgress: (p) => {
      const el = titleRef.current
      if (!el) return
      el.style.transform = `translateY(${p * -120}px)`
      el.style.opacity = String(1 - p)
    },
  })

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        height: "100vh",
        background: "#0e1116",
        color: "white",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <h1
        ref={titleRef}
        style={{
          fontSize: "clamp(48px, 12vw, 120px)",
          willChange: "transform, opacity",
        }}
      >
        scroll me
      </h1>
    </section>
  )
}
```

### Notes

- `start: "top 100%"` means progress reaches 0 when the section's top
  edge is at the bottom of the viewport. `end: "bottom 0%"` means
  progress reaches 1 when the section's bottom edge is at the top of the
  viewport. Tune to taste.
- The example writes inline styles directly. That keeps React out of the
  hot path. If you need to drive several elements off the same trigger,
  store refs for each and update them inside the callback.
- For "stick the element until progress hits 1, then release" use
  `position: sticky` on the element, and let `useScroll` adjust the
  styles inside.
- Pair with `useReducedMotion` to fall back to a static layout when the
  user has requested reduced motion.
