# Devtools

Kinem ships two devtools surfaces:

- **`@kinem/devtools`**: a headless inspector and recorder you import into
  your app. Pairs with an in-page overlay or your own UI.
- **Kinem DevTools (Chrome extension)**: a dedicated DevTools panel that
  connects to any page running kinem and shows live animations.

Both consume the same tracker living inside `@kinem/core`. The tracker is
off by default so production `play()` calls pay nothing for it.

## `@kinem/devtools` (in-page)

Importing the package turns the tracker on as a side effect.

```ts
import { snapshot, mountInspector, mountTimeline, createRecorder } from "@kinem/devtools"
```

### `snapshot()`

Returns an `InspectorSnapshot` of every currently active animation: id,
duration, state, progress, backend, and a serializable target descriptor.
Useful for testing and for building your own UI.

```ts
const snap = snapshot()
console.log(`${snap.animations.length} active`)
```

### `mountInspector(opts?)`

Drops a small overlay into the page that lists every active animation with
per-row pause/resume/cancel. Useful for teams who want a persistent debug
HUD without the Chrome extension.

```ts
mountInspector({ position: "bottom-right" })
```

### `mountTimeline(opts?)`

Renders a horizontal timeline of recent animations with progress bars and
labels. Pairs nicely with `mountInspector`.

### `createRecorder(opts?)`

Subscribes to tracker events and serializes them into a replayable log.

```ts
const rec = createRecorder()
// later
const events = rec.stop()
console.log(JSON.stringify(events))
```

## Chrome extension panel

The Kinem DevTools extension adds a "Kinem" tab to Chrome DevTools. When
the inspected page imports `@kinem/devtools` (or calls `enableTracker()`
directly), the panel auto-connects and shows:

- A live list of active animations with per-row progress bars
- Easing label and animated property names per animation
- Pause / resume / seek to 0, ½, 1 / cancel
- Per-animation speed scrubber
- Per-animation timeline label buttons (for `timeline()` outputs)
- Pause-all and resume-all toolbar buttons
- Recording: a one-click toggle that buffers start/finish/cancel events;
  export as JSON

### Wiring it up

The extension talks to the page through the
`__KINEM_DEVTOOLS_HOOK__` global the tracker installs on `enableTracker()`.
Two ways to enable:

```ts
// Option A: import the devtools package; the tracker enables on import.
import "@kinem/devtools"
```

```ts
// Option B: enable the tracker directly without pulling in any UI code.
import { enableTracker } from "@kinem/core"
enableTracker()
```

### What's in the protocol

Each animation snapshot carries `id`, `duration`, `state`, `progress`,
`startedAt`, `backend`, `targets`, plus optional `easing`, `properties`,
`labels`, and `speed`. Custom UIs that consume the in-page recorder log
get the same shape.

## See also

- [Core concepts](/guide/concepts) covers `AnimationDef` and `Controls`.
- The
  [packages/devtools-extension README](https://github.com/joshburgess/kinem/tree/main/packages/devtools-extension)
  has install instructions for the Chrome extension.
