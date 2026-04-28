# @kinem/core

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is at `0.x`; minor versions may make breaking changes
until 1.0.

## [Unreleased]

### Added

- `stagger()` array overload: `stagger(anims, { each, from? })` accepts
  an array of definitions, one per element, with `count` inferred. The
  existing `stagger(anim, { each, count, from? })` form is unchanged.
- `StaggerArrayOpts` exported alongside `StaggerOpts`.
- `inertia` primitive and `playStagger` driver.
- `path`, `follow`, `jitter`, `morph`, and `scrub` primitives.

### Changed

- `playCanvas` renamed to `playValues`. `tween()` `easing` is now
  optional.
- Reduced-motion handling: SSR audit, leak audit, dedicated error class.
- `bezierPath` interpolation sped up; test gaps closed.

### Fixed

- `BezierPathValue.rotate` and `FollowOpts.commit` doc clarifications.
- `package.json` now declares `publishConfig.access: public` to match
  the other publishable packages.

## [0.2.0] - 2026-04-20

### Added

- Tap, press, pan, and pinch gesture recognizers.
- `Controls.restart()`.
- `progress` and `direction` on `StrategyHandle` and `Controls`.

### Changed

- Package renamed to `@kinem/core` and dual licensed under Apache 2.0
  or MIT.

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

Initial public release.
