# @kinem/devtools-extension

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is at `0.x`; minor versions may make breaking changes
until 1.0.

## [Unreleased]

### Added

- Agent wire-protocol unit tests covering `connect`, `handleCommand`,
  snapshot construction, and the polling fake-timer path.
- Playwright end-to-end smoke test that loads the unpacked extension
  in real Chromium, verifies the manifest, and confirms the page
  agent posts `hello` plus an initial `snapshot` envelope.

## [0.2.0] - 2026-04-20

Initial public release of the standalone Chrome DevTools extension.
The extension talks to any page running `@kinem/core` via the
`__KINEM_DEVTOOLS_HOOK__` global and renders an animation panel.
