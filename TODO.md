# TODO

Open items carried over from the initial project build plan. The core library and all five planned phases are implemented; these are the remaining gaps.

## DevTools

- [x] Chrome DevTools extension scaffolding — `packages/devtools-extension` (MV3 manifest, MAIN/ISOLATED/background/devtools/panel scripts). The core tracker now surfaces itself via `window.__KINEM_DEVTOOLS_HOOK__` so the extension panel can connect without bundling core. Load unpacked from `packages/devtools-extension/dist/` after `pnpm --filter @kinem/devtools-extension build`.

## Docs

- [x] Interactive playground wired into the docs site — a VitePress custom theme registers a global `<Playground>` Vue component that renders an editor + sandboxed iframe loading `/playground/runner.html`. A prebuild step (`docs/scripts/build-playground.mjs`) bundles `@kinem/core` to `docs/public/playground/kinem.mjs`. The getting-started and core-concepts pages embed live examples.

## Showcase

- [x] Flashy showcase app at `examples/showcase/` — standalone Vite app with a sidebar nav. Fifteen demos across two groups:
  - **Gesture** (round out the `tap`/`press`/`pan`/`pinch` recognizers added in 5c0ac64): tap-ripple, press-charge, pan-momentum, pinch-zoom
  - **Showcase**: holo-card (Pokémon-style holographic tilt with spring return-to-neutral), liquid-cursor (CSS goo-trick metaball chain following the cursor), mesh-gradient (WebGL2 5-point Lissajous gradient with kinem spring on the mouse-tracked point and palette-morph on click), confetti-burst (per-particle kinem tween + spring shockwave ring on click), goo-drag (SVG goo filter elastic blob with kinem spring snap-back), particle-field (cursor-reactive spring lattice), text-shatter (per-char spring physics via `splitText`), card-stack (drag-and-throw with `gesture.pan` + spring), scroll-hero (parallax + pinned zoom), shader-reveal (`playUniforms` + FBM noise), magnetic-nav (spring-driven hover attraction + morph pill)
  - Run with `pnpm --filter @kinem/examples-showcase dev`. Each demo is one file in `src/demos/` implementing the `Demo` interface from `src/demo.ts`.
