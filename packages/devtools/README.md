# @kinem/devtools

Inspection, recording, and replay tools for
[kinem](https://github.com/joshburgess/kinem). Headless APIs that build on
the core animation tracker, plus optional in-page overlay and timeline UI
widgets.

Importing this package turns on the core tracker as a side effect. The
tracker is off by default in production `play()` calls, so the runtime cost
is opt-in by importing here.

```ts
import { mountInspector, mountTimeline, snapshot } from "@kinem/devtools"

// One-shot snapshot of every running animation.
console.log(snapshot())

// Floating panel of running animations.
mountInspector({ position: "bottom-right" })

// Scrubbable timeline strip.
mountTimeline({ position: "bottom" })
```

## Install

```sh
pnpm add @kinem/devtools @kinem/core
```

`@kinem/core` is a peer dependency.

## What's exported

- `snapshot()` and `AnimationSnapshot` / `InspectorSnapshot` types
- `mountInspector()` floating panel
- `mountTimeline()` scrubbable timeline strip
- `createRecorder()` event log for replay

For the standalone Chrome DevTools panel that consumes the same tracker,
see [`packages/devtools-extension`](https://github.com/joshburgess/kinem/tree/main/packages/devtools-extension).

## Docs

Full guide and API reference in the
[main repo](https://github.com/joshburgess/kinem#readme).

## License

Dual licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
