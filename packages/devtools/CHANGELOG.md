# @kinem/devtools

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is at `0.x`; minor versions may make breaking changes
until 1.0.

## [Unreleased]

## [0.3.0] - 2026-04-28

### Added

- Ambient lanes: `follow`, `scroll`, `scrub`, and other open-ended
  primitives now surface in the in-page timeline panel. Their bars
  render with an animated diagonal stripe to make it visually obvious
  that "playing" means "still running" rather than "stuck at 0%".
  Honors `prefers-reduced-motion`.

### Fixed

- The timeline panel now updates rows in place instead of rebuilding
  the row DOM on every tick. The previous full-rebuild reset CSS
  animation state every frame, which made the ambient stripe appear
  frozen even when the underlying primitive was live.

The remaining channel-level updates that this package consumes are
documented in `@kinem/core`.

## [0.2.0] - 2026-04-20

### Changed

- Dual licensed under Apache 2.0 or MIT.

## [0.1.0] - 2026-04-19

Initial public release.
