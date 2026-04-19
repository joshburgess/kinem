# Kinem: A Functional/Compositional Animation Library for TypeScript

> npm package: `kinem` | License: MIT

## Project Vision

Kinem is a next-generation TypeScript animation library that combines:

- **Motion's** declarative API and WAAPI hardware acceleration
- **GSAP's** timeline precision, framework-agnosticism, and ability to animate anything
- **React Spring's** physics-based composability
- A **purely functional/compositional** API where animations are values you compose like functions

The core insight: an animation is a function from time → value. Timelines are compositions of these functions. The entire API flows from this idea.

```typescript
// The core abstraction: an Animation is a pure function
type Animation<T> = (t: number) => T

// Everything composes
const fadeIn = tween({ opacity: [0, 1] }, { duration: 500 })
const slideUp = tween({ y: [50, 0] }, { duration: 400 })
const entrance = parallel(fadeIn, slideUp)
const staggered = stagger(entrance, { each: 100 })

// Apply to targets — this is the only impure step
play(staggered, '.card')
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Public API Layer                  │
│  tween() | spring() | sequence() | parallel()       │
│  stagger() | scroll() | gesture() | loop()          │
├─────────────────────────────────────────────────────┤
│               Framework Adapters (optional)          │
│  @kinem/react  |  @kinem/vue  |  @kinem/svelte         │
├─────────────────────────────────────────────────────┤
│                  Scheduler / Batcher                 │
│  Read/write batching | RAF loop | frame priorities   │
├─────────────────────────────────────────────────────┤
│               Rendering Backends                     │
│  WAAPI (hw accel) | rAF (fallback) | Worker (mass)  │
├─────────────────────────────────────────────────────┤
│                  Interpolation Core                  │
│  Numbers | Colors | Units | Transforms | SVG paths  │
├─────────────────────────────────────────────────────┤
│                   Easing Functions                   │
│  Cubic bezier | Spring physics | Steps | Custom     │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Primitives (Weeks 1–3)

**Goal:** Build the foundational type system and interpolation engine. No DOM interaction yet — pure functions only. Everything should be testable with plain values.

### Iteration 1.1 — Type System & Animation Algebra (Week 1)

**Deliverables:**
- `src/core/types.ts` — Core type definitions
- `src/core/animation.ts` — Animation constructors and combinators
- `src/core/easing.ts` — Easing function library
- Full test suite for all combinators

**Key types to implement:**

```typescript
// Core animation type: normalized time (0-1) → value
type Interpolator<T> = (progress: number) => T

// An Animation wraps an interpolator with timing metadata
interface AnimationDef<T> {
  interpolate: Interpolator<T>
  duration: number         // ms, or Infinity for springs
  easing: EasingFn
}

// Composition operators (these return new AnimationDefs)
function sequence<T>(...anims: AnimationDef<T>[]): AnimationDef<T>
function parallel<T>(...anims: AnimationDef<T>[]): AnimationDef<T>
function stagger<T>(anim: AnimationDef<T>, opts: StaggerOpts): AnimationDef<T>
function loop<T>(anim: AnimationDef<T>, count?: number): AnimationDef<T>
function delay<T>(anim: AnimationDef<T>, ms: number): AnimationDef<T>
function reverse<T>(anim: AnimationDef<T>): AnimationDef<T>
function map<A, B>(anim: AnimationDef<A>, fn: (a: A) => B): AnimationDef<B>
```

**Claude Code agent instructions:**
1. Start with `src/core/types.ts`. Define all core types. Make them generic. Animation composition must be type-safe — `sequence()` of two `AnimationDef<number>` returns `AnimationDef<number>`, but `parallel()` of heterogeneous types returns a tuple type.
2. Implement `src/core/easing.ts` with: `linear`, `easeIn`, `easeOut`, `easeInOut`, `cubicBezier(x1, y1, x2, y2)`, `steps(n, position)`, `spring({ stiffness, damping, mass })`. The spring easing should compute actual spring physics, not approximate with a bezier. Use a fixed-step solver (RK4 or verlet integration). Springs have variable duration — compute it as time to reach equilibrium within a threshold (e.g., 0.001 velocity).
3. Implement `src/core/animation.ts`. The key insight: `sequence()` computes total duration as sum of children, and maps time by offsetting into the correct child. `parallel()` uses max duration and runs all children simultaneously. `stagger()` is sugar over `sequence(delay(anim, i * each))`. All combinators must be lazy — they produce new `AnimationDef` objects without executing anything.
4. Write tests in `tests/core/`. Test that `sequence(a, b)` at t=0.5 gives the end of `a` / start of `b`. Test that `reverse(reverse(x))` is equivalent to `x`. Test spring convergence. Test that `map` preserves timing. Aim for 100% branch coverage on combinators.

### Iteration 1.2 — Interpolation Engine (Week 2)

**Deliverables:**
- `src/interpolate/number.ts` — Numeric interpolation
- `src/interpolate/color.ts` — Color space interpolation (OKLCH preferred)
- `src/interpolate/units.ts` — CSS unit parsing and interpolation
- `src/interpolate/transform.ts` — CSS transform decomposition/recomposition
- `src/interpolate/path.ts` — SVG path interpolation
- `src/interpolate/registry.ts` — Type-dispatched interpolation registry

**Claude Code agent instructions:**
1. Each interpolator module exports a function `(from: T, to: T) => (progress: number) => T`. These are pure functions — no side effects.
2. For colors: parse hex, rgb(), hsl(), oklch(). Interpolate in OKLCH space (perceptually uniform). Return as the format of the target value. DO NOT interpolate in RGB — it produces muddy intermediate colors.
3. For CSS units: parse `"100px"`, `"50%"`, `"10rem"`, `"2vw"` etc. When units match, interpolate the number. When they don't, flag it — unit conversion requires DOM measurement and will be handled in the rendering layer later.
4. For transforms: decompose `transform` strings into `{ translate, rotate, scale, skew }` components. Interpolate each independently. Recompose into a transform string. Rotation must interpolate through the shortest arc (handle 350deg → 10deg correctly — it should go through 360/0, not backwards through 180).
5. For SVG paths: implement path normalization (both paths must have the same number/type of commands). Use Flubber-style point insertion for mismatched paths. Interpolate control points individually.
6. The registry should auto-detect value types: if it looks like a color, use color interpolation. If it has units, use unit interpolation. If it's a number, use number interpolation. Allow users to register custom interpolators for new types.
7. Write extensive tests. Color interpolation mid-points should be verified against known OKLCH values. Transform decomposition roundtrips must be exact.

### Iteration 1.3 — The `tween()` Constructor (Week 3)

**Deliverables:**
- `src/api/tween.ts` — The primary user-facing animation constructor
- `src/api/spring.ts` — Physics-based animation constructor
- `src/api/keyframes.ts` — Multi-keyframe animation support
- Updated test suite

**Key API to implement:**

```typescript
// Simple tween
const fade = tween({ opacity: [0, 1] }, { duration: 300, easing: easeOut })

// Multi-property tween (all properties share timing)
const move = tween(
  { x: [0, 100], y: [0, 50], opacity: [0, 1] },
  { duration: 500, easing: cubicBezier(0.16, 1, 0.3, 1) }
)

// Keyframes (per-property or unified)
const bounce = keyframes({
  y: [0, -50, 0, -25, 0],
  scale: [1, 1.1, 1, 1.05, 1],
}, { duration: 800, easing: easeOut })

// Spring (no explicit duration — it's computed from physics)
const springy = spring({ x: [0, 100] }, {
  stiffness: 200,
  damping: 15,
  mass: 1,
})
```

**Claude Code agent instructions:**
1. `tween()` should parse its property map, select the correct interpolator for each property via the registry, and return an `AnimationDef` whose `interpolate` function returns a `Record<string, any>` of current values at any given progress.
2. `spring()` should run actual spring simulation. The duration is not user-specified — compute it as the time until the spring settles (velocity < threshold). Cache the simulation results as a lookup table on first call, then binary-search for subsequent lookups. This amortizes the physics computation.
3. `keyframes()` distributes keyframe stops evenly by default (like CSS) but accepts an `offsets` array for custom positioning. Between each pair of keyframes, use the interpolation registry.
4. All three constructors return `AnimationDef` — they compose with `sequence()`, `parallel()`, etc. from Phase 1.
5. Test that `spring()` actually converges. Test that keyframe offsets produce correct intermediate values. Test that tween properties use the correct interpolator (colors get color interpolation, numbers get number interpolation, etc.)

---

## Phase 2: Rendering & Scheduling (Weeks 4–6)

**Goal:** Connect the pure animation core to the DOM. Build the scheduler that decides how to render each animation (WAAPI vs rAF). Implement read/write batching.

### Iteration 2.1 — Frame Scheduler & Batching (Week 4)

**Deliverables:**
- `src/scheduler/frame.ts` — RAF-based frame loop with read/write phases
- `src/scheduler/batch.ts` — Batched DOM read/write queue
- `src/scheduler/clock.ts` — Monotonic clock with pause/resume support
- Performance benchmarks (layout thrashing comparison)

**Claude Code agent instructions:**
1. Implement a frame scheduler modeled on Motion's `frame` API but extended. Each frame has four phases executed in strict order: `read` → `compute` → `update` → `render`. Jobs added to a phase execute in insertion order within that phase. This prevents layout thrashing because all DOM reads happen before any writes.
2. The scheduler should be a singleton (one RAF loop for the whole page). Multiple animations share one loop. The loop sleeps (cancels RAF) when no animations are active and wakes when new ones start.
3. Implement `clock.ts` as a monotonic time source. It should support `pause()`, `resume()`, `setSpeed(multiplier)` for dev tools / debugging. The clock is injected into animations, not imported globally — this makes testing trivial (use a mock clock).
4. Build a micro-benchmark: create 500 DOM elements, animate `transform` on all of them with batching vs. naive per-element updates. Measure layout thrashing via `performance.mark/measure`. The batched version should show zero forced reflows. Include this benchmark as a runnable test.
5. Export a public `frame` API for advanced users:
```typescript
frame.read(() => { /* safe to measure DOM */ })
frame.update(() => { /* safe to mutate DOM */ })
```

### Iteration 2.2 — WAAPI Rendering Backend (Week 5)

**Deliverables:**
- `src/render/waapi.ts` — Web Animations API backend
- `src/render/raf.ts` — requestAnimationFrame fallback backend
- `src/render/strategy.ts` — Auto-detection and routing
- `src/render/properties.ts` — Property classification (compositable vs layout-triggering)

**Claude Code agent instructions:**
1. Classify CSS properties into tiers:
   - **Compositor-safe** (use WAAPI): `transform`, `opacity`, `filter`, `clip-path`, `background-color` on some engines
   - **Main-thread required** (use rAF): `width`, `height`, `top`, `left`, `border-radius`, `box-shadow`, SVG attributes, arbitrary JS object properties
   - **Mixed**: animations that combine both types
2. The WAAPI backend should convert an `AnimationDef` into `Element.animate()` calls. Map the easing functions to CSS easing strings where possible (cubic-bezier maps directly, springs need to be converted to linear() easing with sampled points — the `linear()` CSS function accepts a list of points).
3. The rAF backend should use the frame scheduler from 2.1. On each frame: compute current progress from elapsed time, run the `AnimationDef`'s interpolate function, apply the resulting values to the element's style.
4. The strategy module should inspect which properties an animation targets, then automatically split it: compositor-safe properties go to WAAPI, layout-triggering properties go to rAF. Both halves are synchronized via the shared clock. This hybrid approach is the key performance advantage.
5. Handle edge cases: what if the user animates `transform` and `width` simultaneously? Split into two underlying animations. What if WAAPI isn't supported (very old browsers)? Fall back to rAF for everything. What about `will-change`? Auto-apply it before animation starts, remove it after.
6. Test by mocking `Element.animate` and verifying correct keyframes and options are passed. Test the strategy router with various property combinations.

### Iteration 2.3 — The `play()` Function & Controls (Week 6)

**Deliverables:**
- `src/api/play.ts` — Connects AnimationDefs to DOM targets
- `src/api/controls.ts` — Playback control interface
- `src/api/timeline.ts` — GSAP-style timeline with labels and relative positioning
- Integration tests with real DOM (jsdom or Playwright)

**Key API:**

```typescript
// play() is the bridge between pure animations and the DOM
const controls = play(entrance, '.card')

// Controls interface
controls.pause()
controls.resume()
controls.reverse()
controls.seek(0.5)          // seek to 50%
controls.seekLabel('intro') // seek to a named label
controls.speed = 2          // double speed
controls.then(() => { })    // promise-based completion
controls.cancel()

// Timeline — imperative sequencing with relative positioning
const tl = timeline()
tl.add(fadeIn, '.hero', { label: 'intro' })
tl.add(slideUp, '.subtitle', { at: 'intro', offset: 200 })  // 200ms after 'intro' label
tl.add(staggerIn, '.card', { at: '<', offset: -100 })        // 100ms before previous ends
tl.add(colorShift, '.bg', { at: 0.5 })                       // at 50% of timeline

const controls = tl.play()
```

**Claude Code agent instructions:**
1. `play(animDef, target)` should: resolve target (string selector → elements, element → [element], NodeList → array), determine rendering strategy per-property, instantiate the appropriate backend(s), and return a `Controls` object.
2. The `Controls` object wraps the underlying WAAPI Animation objects and/or rAF-driven state. `pause()` on a hybrid animation must pause both the WAAPI and rAF sides. `seek()` must synchronize both.
3. `timeline()` returns a builder. `.add()` places an animation at a specific point. Support GSAP-style relative positioning: `'<'` means start of previous, `'>'` means end of previous, `'intro'` means at label, and numeric values mean absolute time. The timeline itself is an `AnimationDef` — you can nest timelines inside timelines, or compose them with `sequence()` / `parallel()`.
4. `play()` should return a `PromiseLike` — you can `await play(fade, '.el')` to wait for completion. But it's not a raw Promise: the Controls object has `.then()` so it works with await but also has `.pause()` etc.
5. Write integration tests using Playwright or happy-dom. Verify: animation starts and completes, pause/resume works, seek jumps to correct state, reverse plays backwards, speed multiplier works, promise resolves on completion, cancel stops and cleans up.

---

## Phase 3: Scroll & Gestures (Weeks 7–9)

**Goal:** Scroll-linked animations, gesture-driven interactions, and the `scroll()` / `gesture()` APIs.

### Iteration 3.1 — Scroll-Linked Animations (Week 7)

**Deliverables:**
- `src/scroll/observer.ts` — Intersection and scroll position observer
- `src/scroll/timeline.ts` — Scroll-linked timeline driver
- `src/api/scroll.ts` — Public scroll animation API
- Tests and scroll-based demos

**Key API:**

```typescript
// Scroll-triggered (plays when element enters viewport)
scroll(entrance, '.card', {
  trigger: { start: 'top 80%', end: 'top 20%' },
  toggleActions: 'play none none reverse',
})

// Scroll-linked (progress tracks scroll position)
scroll(parallax, '.hero-bg', {
  sync: true,  // progress = scroll position, no duration
  trigger: { start: 'top top', end: 'bottom top' },
})

// Horizontal scroll
scroll(slideShow, '.panel', {
  axis: 'x',
  container: '.scroll-container',
})
```

**Claude Code agent instructions:**
1. Check if CSS Scroll Timeline is supported (`CSS.supports('animation-timeline', 'scroll()')`). If yes, use it for scroll-synced WAAPI animations — this runs entirely off the main thread. If no, fall back to Intersection Observer + scroll event listener with throttling.
2. Implement trigger position parsing. GSAP-style strings like `"top 80%"` mean "when the top of the element hits 80% of the viewport." Parse these into numeric thresholds.
3. For scroll-synced animations (`sync: true`), the scroll position directly drives animation progress. Map scroll range to 0–1 progress. Use the same `AnimationDef` system — the only difference is the time source (scroll position instead of clock).
4. For scroll-triggered animations, use Intersection Observer to detect entry/exit, then play/reverse/pause based on `toggleActions`. This matches GSAP's ScrollTrigger API pattern.
5. Implement `pin` support: fix an element in place while a scroll animation plays through. This requires toggling `position: fixed` and compensating for the layout shift. Be careful with stacking contexts.
6. CRITICAL: never bind expensive computation directly to the `scroll` event. Use passive listeners, `requestAnimationFrame` throttling, and Intersection Observer wherever possible.

### Iteration 3.2 — Gesture Animations (Week 8)

**Deliverables:**
- `src/gesture/pointer.ts` — Unified pointer event handling (mouse + touch)
- `src/gesture/drag.ts` — Drag with momentum and snapping
- `src/gesture/recognizers.ts` — Tap, press, pan, pinch recognizers
- `src/api/gesture.ts` — Public gesture API

**Key API:**

```typescript
// Drag with spring-back
gesture('.draggable', {
  drag: {
    axis: 'x',
    bounds: { left: -200, right: 200 },
    onRelease: spring({ stiffness: 300, damping: 20 }),
    snap: { points: [-200, 0, 200], threshold: 50 },
  },
})

// Hover-driven animation
gesture('.button', {
  hover: {
    enter: tween({ scale: [1, 1.05] }, { duration: 200 }),
    leave: tween({ scale: [1.05, 1] }, { duration: 300 }),
  },
})

// Composable: scroll + gesture
const card = parallel(
  scroll(fadeIn, { sync: true }),
  gesture({ drag: { axis: 'y' } }),
)
```

**Claude Code agent instructions:**
1. Use PointerEvents API (not mouse/touch separately). Normalize across devices. Track velocity using the last N pointer positions (ring buffer, compute velocity on release for momentum).
2. Drag should work by applying `transform: translate()` during the gesture, then on release, either snap to nearest point (with spring animation) or spring back to origin.
3. Gesture recognizers should be composable — a "swipe" is a "pan" that exceeds a velocity threshold. A "press" is a "tap" that exceeds a duration threshold. Build from primitives.
4. Gestures must integrate with the animation system. When a drag starts, it should cancel any active animation on that element's transform. When it ends, the spring-back is a regular `spring()` animation played via `play()`. This means gestures and animations share the same property ownership model — no conflicts.
5. Handle touch-action CSS correctly. The library should auto-apply `touch-action: none` (or the appropriate axis restriction) on drag targets to prevent browser scroll interference.

### Iteration 3.3 — Performance Optimization Pass (Week 9)

**Deliverables:**
- `src/render/worker.ts` — Web Worker for mass interpolation
- Benchmark suite comparing Kinem vs Motion vs GSAP
- Bundle size analysis and tree-shaking verification
- Performance regression test suite

**Claude Code agent instructions:**
1. Build a Web Worker module that can run interpolation math off the main thread. The main thread sends: current time, list of active animations (serialized as start time + duration + easing parameters). The worker computes all interpolated values and sends them back. The main thread applies them in a batched write. Measure whether the coordination overhead is worth it — it likely only helps with 100+ simultaneous animations.
2. Create a benchmark suite that tests:
   - **Startup cost**: time to parse and prepare 1000 animations
   - **Runtime cost**: time per frame with 100 / 500 / 1000 active animations
   - **Memory**: heap snapshots during animation
   - **Bundle size**: full library, tree-shaken for common use cases (tween only, tween + scroll, full)
   Compare against Motion and GSAP using the same animation scenarios.
3. Audit the full library for tree-shakability. Run Rollup with each entry point and verify dead code is eliminated. Every feature should be importable independently. Target sizes:
   - `tween` + `play`: < 3kb gzipped
   - `+ scroll`: < 5kb gzipped
   - `+ gesture`: < 7kb gzipped
   - Full library: < 12kb gzipped
4. Set up a performance regression CI test. On every PR, run the benchmark suite and fail if any metric regresses by more than 10%.

---

## Phase 4: Framework Adapters (Weeks 10–12)

**Goal:** First-class React, Vue, and Svelte integrations. The vanilla JS API is primary; framework adapters are thin wrappers.

### Iteration 4.1 — React Adapter: `@kinem/react` (Week 10)

**Deliverables:**
- `packages/react/src/motion.tsx` — `<Motion>` component
- `packages/react/src/hooks.ts` — `useAnimation`, `useScroll`, `useSpring`, `useGesture`
- `packages/react/src/presence.tsx` — `<AnimatePresence>` for exit animations
- `packages/react/src/layout.tsx` — Layout animation support (FLIP)
- Full test suite with React Testing Library

**Key API:**

```tsx
import { Motion, useAnimation, AnimatePresence } from '@kinem/react'

// Declarative component API (like Motion/Framer Motion)
<Motion
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 300, easing: easeOut }}
/>

// Hook API (composable, more control)
function Card() {
  const anim = useAnimation()

  // Compose animations functionally
  const entrance = sequence(
    tween({ opacity: [0, 1] }, { duration: 200 }),
    tween({ y: [20, 0] }, { duration: 300, easing: easeOut }),
  )

  return <div ref={anim.ref} onClick={() => anim.play(entrance)} />
}

// Spring-driven values
function Cursor() {
  const x = useSpring(0, { stiffness: 300, damping: 20 })

  return (
    <Motion style={{ x: x.value }}
      onPointerMove={(e) => x.set(e.clientX)}
    />
  )
}

// Presence (exit animations)
<AnimatePresence>
  {items.map(item => (
    <Motion key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  ))}
</AnimatePresence>

// Layout animations (automatic FLIP)
<Motion layout>
  {/* position/size changes animate automatically */}
</Motion>
```

**Claude Code agent instructions:**
1. The `<Motion>` component should be a thin wrapper. It creates a ref, watches for prop changes, and calls the vanilla `play()` API. It should NOT trigger React re-renders during animation — animate via refs and direct DOM manipulation, not state updates.
2. `useAnimation()` returns a controller bound to a ref. It exposes `play()`, `pause()`, `seek()`, etc. The ref connects to the DOM element. Animations run outside React's render cycle.
3. `AnimatePresence` must intercept children removal. When a child's key disappears, delay its unmounting, play its `exit` animation, then remove it from the DOM. Use `React.cloneElement` and a ref cache. Handle interruptions — if an exiting element re-enters, cancel the exit and play the enter animation.
4. Layout animations: on every render, read the element's bounding rect (via `getBoundingClientRect`), compare to the previous rect, and if different, animate the delta using FLIP (First, Last, Invert, Play). Apply an inverse transform immediately, then animate it to identity. Use WAAPI for the transform animation.
5. CRITICAL: all animations must clean up on unmount. Use `useEffect` cleanup. Cancel any in-progress WAAPI animations and rAF callbacks. Leaked animations are a common source of bugs.
6. Test with React 18+ concurrent features. Animations should not break with `<StrictMode>` double-rendering.

### Iteration 4.2 — Vue Adapter: `@kinem/vue` (Week 11)

**Deliverables:**
- `packages/vue/src/Motion.vue` — `<Motion>` component
- `packages/vue/src/composables.ts` — `useAnimation`, `useScroll`, `useSpring`
- `packages/vue/src/transition.ts` — Integration with Vue's `<Transition>` system
- Test suite

**Claude Code agent instructions:**
1. Mirror the React adapter's API shape but use Vue idioms: composables instead of hooks, `<Transition>` integration for enter/leave, `v-motion` directive for simple cases.
2. Use Vue's `onMounted` / `onBeforeUnmount` for lifecycle. Template refs for element access. `watch()` for reactive prop-driven animations.
3. Integrate with Vue's built-in `<Transition>` and `<TransitionGroup>` by providing custom CSS classes and JavaScript hooks. Don't reinvent Vue's transition system — extend it.
4. Test with Vue 3.4+ and Nuxt 3 SSR (ensure no server-side errors from DOM access).

### Iteration 4.3 — Svelte Adapter: `@kinem/svelte` (Week 12)

**Deliverables:**
- `packages/svelte/src/motion.ts` — Svelte action `use:motion`
- `packages/svelte/src/spring.ts` — Spring store
- `packages/svelte/src/transition.ts` — Custom transition functions
- Test suite

**Claude Code agent instructions:**
1. Svelte's paradigm is different — use actions (`use:motion={params}`) and stores. A spring store is a writable store whose value animates to the target when set.
2. Provide custom transition functions compatible with Svelte's `transition:`, `in:`, `out:` directives. These receive the element and return `{ duration, css, tick }`. Use the Kinem interpolation engine for the `css` function to generate keyframe strings, or `tick` for JS-driven updates.
3. Ensure compatibility with Svelte 5 runes and the new reactivity model.
4. Test with SvelteKit SSR.

---

## Phase 5: Advanced Features & Polish (Weeks 13–16)

### Iteration 5.1 — DevTools (Week 13)

**Deliverables:**
- `packages/devtools/src/inspector.ts` — Animation inspector overlay
- `packages/devtools/src/timeline-ui.ts` — Visual timeline scrubber
- `packages/devtools/src/recorder.ts` — Animation recording/replay
- Browser extension scaffolding (Chrome)

**Claude Code agent instructions:**
1. Build an in-page overlay (injected via `kinem.devtools()`) that shows: all active animations, their targets, progress, and timing. Clicking an animation highlights its target element.
2. A visual timeline scrubber: pause all animations globally, drag a scrubber to seek through time. Show each animation as a bar on a track (like a video editor). Color-code by rendering backend (green = WAAPI/hardware accelerated, orange = rAF/main thread).
3. Performance panel: show frame times, flag any frame that exceeds 16ms, identify which animation caused it.
4. A recording mode: capture all animation events (start, pause, seek, complete) with timestamps. Export as JSON. Replay to reproduce bugs.
5. Package as a Chrome DevTools extension that adds a "Kinem" panel. Use Chrome's DevTools protocol for element inspection integration.

### Iteration 5.2 — SVG, Canvas, WebGL Targets (Week 14)

**Deliverables:**
- `src/render/svg.ts` — SVG attribute animation (not just CSS on SVG elements)
- `src/render/canvas.ts` — Canvas 2D animation driver
- `src/render/webgl.ts` — WebGL uniform animation driver
- Demos for each

**Claude Code agent instructions:**
1. SVG: animate SVG-specific attributes (`d`, `points`, `viewBox`, `stroke-dasharray`, `stroke-dashoffset`). Use `setAttribute()` in the rAF backend. Path morphing should use the interpolation engine from Phase 1.
2. Canvas: provide a driver where the user supplies a `render(state)` callback. The animation system computes the current state each frame and calls the render function. The user draws whatever they want with the interpolated values.
3. WebGL: similar to canvas, but specifically target uniform updates. Provide helpers for common cases: animating `vec2`, `vec3`, `vec4`, `mat4` uniforms. Integrate with Three.js as an optional extension.
4. All of these use the rAF backend (no WAAPI for non-DOM targets), but benefit from the same batching, composition, and timeline features.

### Iteration 5.3 — Text Splitting & Stagger Patterns (Week 15)

**Deliverables:**
- `src/text/split.ts` — Text splitting (chars, words, lines)
- `src/text/stagger-patterns.ts` — Advanced stagger: from center, from edges, random, wave
- Demos of text reveal animations

**Claude Code agent instructions:**
1. Text splitting: wrap each character/word/line in a `<span>` with appropriate CSS (`display: inline-block` for transform support). Handle whitespace correctly. Support nested HTML within the text.
2. Revert function: after animation completes, unwrap the spans and restore original HTML. This is important for accessibility and SEO.
3. Stagger patterns beyond linear: `from: 'center'` starts from the middle and radiates outward. `from: 'edges'` starts from both ends and meets in the middle. `from: [x, y]` for 2D grid staggers (elements closer to the point start first). `random` shuffles order. `wave` applies a sine-wave offset.
4. These should compose with the existing `stagger()` combinator — they're just different strategies for computing per-element delay.

### Iteration 5.4 — Documentation, Examples & Launch Prep (Week 16)

**Deliverables:**
- Documentation site (use Astro or similar SSG)
- Interactive playground (live code editor with preview)
- Migration guides from GSAP and Motion
- 20+ copy-pasteable examples covering common patterns
- npm package publishing setup (monorepo with changesets)
- CI/CD pipeline (tests, benchmarks, bundle size checks, publishing)

**Claude Code agent instructions:**
1. Documentation structure: Getting Started, Core Concepts (the animation-as-function philosophy), API Reference (auto-generated from TSDoc), Guides (scroll animations, gestures, timelines, framework usage), Examples, Migration.
2. Every API page should have a live, editable example. Use a sandboxed iframe with the library pre-loaded.
3. Migration guides should show side-by-side: "In GSAP you write X, in Kinem you write Y." Cover the 20 most common GSAP patterns and their Kinem equivalents. Same for Motion.
4. Monorepo structure:
```
packages/
  core/          → kinem (main package)
  react/         → @kinem/react
  vue/           → @kinem/vue
  svelte/        → @kinem/svelte
  devtools/      → @kinem/devtools
```
5. Use changesets for versioning. GitHub Actions for CI: lint, test, benchmark, bundle size check, publish to npm on tagged releases.
6. README should lead with the composability pitch and a compelling code example, not a feature list.

---

## Cross-Cutting Concerns (Apply Throughout)

### Testing Strategy

- **Unit tests** (vitest): Core animation algebra, interpolation, easing. Pure functions, no DOM.
- **Integration tests** (happy-dom or jsdom): Scheduler, rendering backends, play/controls API.
- **E2E tests** (Playwright): Visual regression tests for actual rendered animations. Screenshot comparison at key frames.
- **Performance tests**: Benchmark suite that runs on CI and fails on regression.
- **Fuzz tests**: Feed random values into interpolators and verify no NaN/Infinity/crashes.

### Code Quality

- Strict TypeScript (`strict: true`, no `any` except in tests)
- ESLint with recommended + strict rules
- Prettier for formatting
- TSDoc comments on all public APIs
- `api-extractor` for API surface management (prevent accidental public API changes)

### Bundle Optimization

- Every module should be independently importable
- No side effects in module scope (tree-shaking safe)
- Mark all packages with `"sideEffects": false` in package.json
- Use `export type` for type-only exports
- Benchmark: `import { tween, play } from 'kinem'` should tree-shake to < 3kb gzipped

### Naming

- The project name is **Kinem** (npm package: `kinem`, verified available as of April 2026)
- "Kinem" = a recurring pattern/theme — maps to the composable animation philosophy. Also has musical connotation (short melodic phrase) fitting the timeline/sequencing metaphor.
- Scoped packages: `@kinem/react`, `@kinem/vue`, `@kinem/svelte`, `@kinem/devtools`
- All public API names should be verbs or nouns, never abbreviations
- Internal modules use descriptive names, not clever ones

---

## Agent Workflow Notes

Each iteration should follow this cycle:

1. **Read the spec above** for that iteration
2. **Set up the directory structure** and `package.json` / `tsconfig.json` before writing code
3. **Write types first** — define the interfaces, then implement
4. **Write tests alongside implementation** — not after. Each function should have a test before moving to the next function
5. **Run tests continuously** (`vitest --watch`)
6. **At the end of each iteration**: run the full test suite, check bundle size, update CHANGELOG.md
7. **Commit with conventional commits** (`feat:`, `fix:`, `test:`, `refactor:`)

For multi-agent setups: Phase 1 (core) must complete before Phase 2 (rendering) begins. Phase 3 (scroll/gesture) and Phase 4 (framework adapters) can run in parallel since they both depend on Phase 2 but not each other. Phase 5 depends on all prior phases.

```
Phase 1 (Core) → Phase 2 (Rendering) → Phase 3 (Scroll/Gesture)
                                      ↘ Phase 4 (Frameworks)     → Phase 5 (Polish)
```
