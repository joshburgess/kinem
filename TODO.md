# TODO

Open items carried over from the initial project build plan. The core library and all five planned phases are implemented; these are the remaining gaps.

## Gestures

- [ ] `packages/core/src/gesture/recognizers.ts` — general tap / press / pan / pinch recognizers built on the pointer primitives. Today only `drag.ts` and `hover.ts` exist. Swipe should fall out as a pan past a velocity threshold; press as a tap past a duration threshold.

## Framework adapters

- [ ] `@kinem/react`: `useScroll` hook wrapping the core `scroll()` API.
- [ ] `@kinem/vue`: `useScroll` composable wrapping the core `scroll()` API.

## DevTools

- [ ] Chrome DevTools extension scaffolding. The in-page overlay, timeline scrubber, and recorder all exist in `@kinem/devtools`, but there is no extension manifest / panel wiring that surfaces them as a dedicated "Kinem" DevTools panel.

## Docs

- [ ] Interactive playground wired into the docs site. Example files live under `examples/playground/` and the VitePress site is set up, but the live, editable, sandboxed-iframe experience described in the original plan is not integrated into the published docs yet.
