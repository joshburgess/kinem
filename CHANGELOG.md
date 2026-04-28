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
