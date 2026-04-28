# @kinem/svelte

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is at `0.x`; minor versions may make breaking changes
until 1.0.

## [Unreleased]

### Changed

- Reduced-motion handling reaches parity with the other adapters and
  the core: opt-in resolution via `play()`, surfaced through the
  store and the `use:motion` action.

## [0.2.0] - 2026-04-20

### Added

- `scroll` action for scroll-linked animations, mirroring the React
  and Vue `useScroll` hook.

### Changed

- Dual licensed under Apache 2.0 or MIT.

## [0.1.0] - 2026-04-19

Initial public release.
