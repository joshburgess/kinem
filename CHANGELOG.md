# Changelog

All notable changes to kinem are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is at `0.x`; minor versions may make breaking changes
until 1.0.

## [Unreleased]

### Added

- `stagger()` array overload: `stagger(anims, { each, from? })` accepts
  an array of definitions, one per element, with `count` inferred. The
  existing `stagger(anim, { each, count, from? })` form is unchanged.
- `StaggerArrayOpts` exported alongside `StaggerOpts`.
- `@kinem/devtools-extension`: agent wire-protocol unit tests and a
  Playwright e2e smoke test that confirms the manifest loads and the
  agent posts `hello` + initial `snapshot` envelopes in real Chromium.
- API snapshot script (`pnpm api:check`), coverage thresholds, perf
  benches, and a Playwright smoke layer over `examples/playground`.
- Cross-library bundle-size benchmark (`pnpm size:compare`).
- `inertia` primitive and `playStagger` driver.
- `path`, `follow`, `jitter`, `morph`, and `scrub` primitives.
- Realistic `morphPath` benchmark.
- Lava lamp and other showcase demos in `@kinem/examples-showcase`.
- Per-package READMEs for `@kinem/core`, `@kinem/devtools`, `@kinem/react`,
  `@kinem/vue`, and `@kinem/svelte`.

### Changed

- `playCanvas` renamed to `playValues`; `tween()` `easing` is now
  optional.
- Reduced-motion handling: SSR audit, leak audit, adapter parity,
  dedicated error class.
- `bezierPath` interpolation sped up; test gaps closed.

### Fixed

- Workspace typecheck no longer requires a prior `build`.
- `BezierPathValue.rotate` and `FollowOpts.commit` doc clarifications.
- `@kinem/core` `package.json` now declares `publishConfig.access: public`
  to match the other publishable packages.
- Docs playground iframe destructured the renamed `playCanvas` symbol;
  updated to `playValues` so embedded samples no longer throw on Run.
- `play(stagger(...), targets)` now actually fans out per-element values
  to per-element targets. Previously the renderer iterated the array as
  a property bag and silently wrote nothing. `stagger()` output now
  carries an internal `fanOut` hint that `play()` detects and routes
  through a single rAF loop that samples once per frame and dispatches
  `value[i]` to `target[i]`.
- `playStagger()` and `playValues()` (and `playUniforms()` by
  extension) now report to the devtools tracker, so canvas, WebGL, and
  fan-out staggered animations show up in the devtools panel alongside
  `play()` calls. Previously only animations routed through `play()`
  were visible.
- `follow()`, `scrub()`, and `scroll()` now register with the devtools
  tracker as ambient (open-ended) records, so cursor trails, scrub
  handles, and scroll-driven animations show up in the panel. Ambient
  records render with a striped lane in the local timeline panel to
  distinguish them from clock-driven animations.
- Cancelling a `follow()` / `scrub()` / `scroll()` handle directly (the
  common path: demos call `handle.cancel()` from their cleanup) now
  removes the ambient record from the tracker. Previously the record
  only cleared if the caller invoked `record.controls.cancel()` via the
  tracker façade, leaving comet-trail / ribbon-trail panel rows stuck
  on every demo unmount.
- Ambient lanes in the local timeline panel now render with an animated
  diagonal stripe so the bar visually conveys "running" instead of
  appearing frozen. Honors `prefers-reduced-motion`.
- Showcase demos that previously drove their own raf loops (lava-lamp,
  cube-wall, shape-morph, heat-shimmer, starfield-warp, galaxy-spiral,
  toss-card, liquid-cursor) now drive through `playValues`, so they
  appear in the devtools panel too.
- Pinch-zoom demo now releases through `inertia` (clamped to scale
  bounds) when there's nontrivial pinch velocity, falling back to the
  existing `spring` snapback for slow / in-bounds releases. Both paths
  go through `playValues`, so every release records in the panel and
  the demo's "with inertia" title is no longer aspirational.
- Devtools timeline panel and the standalone Chrome extension panel
  now update rows in place instead of rebuilding the row DOM on every
  tick. The previous full-rebuild reset CSS animation state on every
  poll, which made the ambient stripe (used by `follow` / `scroll` /
  `scrub` records) visually frozen even though the underlying
  primitive was live.
- Chrome extension panel now renders ambient backends with the same
  animated diagonal stripe used by the in-page timeline, so
  open-ended primitives no longer look like a stuck "playing · 0%"
  bar.
- Cursor-reactive particle field demo now drives its canvas tick
  through `playValues` (so it shows up in the devtools panel) and
  drifts a Lissajous "ghost" cursor whenever the real pointer isn't
  engaged, so the lattice has visible motion on first paint instead
  of looking inert until you mouse in.
- Heat shimmer / "MIRAGE" demo amplitudes increased so the wobble is
  perceptible. The previous coefficients (max ~0.4 px translate)
  rounded to a static glyph at most viewing distances.
- Physics card stack demo: in-flight layout springs are now cancelled
  when a new fling triggers `rebindAll()`, and tracked per element so
  a fresh drag takes ownership of the top card without racing the
  previous spring. Fixes per-card jitter mid-rebind and unbounded
  growth of the active-plays array.
- Stretchy goo drag demo now registers an ambient session for the
  duration of the drag itself (via `trackAmbient` / `untrackAmbient`),
  so the panel shows activity throughout the stretch instead of only
  during the spring snap-back at release.

## [0.2.0] - 2026-04-20

### Added

- Tap, press, pan, and pinch gesture recognizers.
- `useScroll` hook for the React, Vue, and Svelte adapters.
- Standalone Chrome DevTools extension (`@kinem/devtools-extension`).
- VitePress documentation site under `docs/` with an interactive
  playground.
- `@kinem/examples-showcase` app.
- `Controls.restart()`.
- `progress` and `direction` on `StrategyHandle` and `Controls`.

### Changed

- Renamed the core package to `@kinem/core` and dual licensed under
  Apache 2.0 or MIT.
- Toolchain upgrade: vitest 4, vite 7, typescript 5.9.
- Switched from changesets to manual publishing.

### Fixed

- `setSpeed` multiplier is validated before `Timing` rebases.
- `combineHandles` state now derives from its children.
- Cancellation always settles the `finished` promise terminally.

### Performance

- Direct-commit path on `tween()` for the same-value case; frame-time
  reuse inside `Timing`.
- Folded lazy WAAPI handle setup into `WaapiImpl`; dropped `will-change`
  writes for compositor properties.
- Shared one cancelled `Error` across all `rejectCancelled()` calls.
- Deferred `createClock()` in `Timing` until the first tick; deferred
  error allocation on cancel via `LazyPromise.rejectCancelled`.
- Class-based rewrites of `lazyHandle`, `playWaapi`, `Clock`, and
  `LazyPromise` to remove per-play closure overhead.
- Dropped the `interpolate()` trampoline arrow.

## [0.1.0] - 2026-04-19

Initial public release of the publishable packages
(`@kinem/core`, `@kinem/devtools`, `@kinem/react`, `@kinem/vue`,
`@kinem/svelte`).

[Unreleased]: https://github.com/joshburgess/kinem/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/joshburgess/kinem/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/joshburgess/kinem/releases/tag/v0.1.0
